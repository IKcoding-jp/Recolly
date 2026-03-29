# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::TmdbAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:api_key) { 'test_tmdb_key' }

  # WikipediaClientのデフォルトモック（Wikipedia経由フォールバック検索テストで上書きする）
  let(:default_wikipedia_client) { instance_double(ExternalApis::WikipediaClient) }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('TMDB_API_KEY').and_return(api_key)
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(default_wikipedia_client)
    allow(default_wikipedia_client).to receive(:search).and_return([])
  end

  describe '#media_types' do
    it 'movie と drama を返す' do
      expect(adapter.media_types).to eq(%w[movie drama])
    end
  end

  describe '#search' do
    # search/movie用レスポンス（media_typeフィールドなし、タイトルはtitleキー）
    let(:movie_response) do
      {
        'results' => [
          {
            'id' => 550,
            'title' => 'ファイト・クラブ',
            'overview' => '空虚な生活を送る男の物語',
            'poster_path' => '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
            'release_date' => '1999-10-15',
            'genre_ids' => [18, 53],
            'original_language' => 'en',
            'popularity' => 61.5
          }
        ]
      }
    end

    # search/tv用レスポンス（media_typeフィールドなし、タイトルはnameキー）
    let(:tv_response) do
      {
        'results' => [
          {
            'id' => 1396,
            'name' => 'ブレイキング・バッド',
            'overview' => '化学教師が犯罪に手を染める',
            'poster_path' => '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
            'first_air_date' => '2008-01-20',
            'genre_ids' => [18],
            'original_language' => 'en',
            'popularity' => 120.3
          }
        ]
      }
    end

    before do
      stub_request(:get, %r{api.themoviedb.org/3/search/movie})
        .to_return(status: 200, body: movie_response.to_json, headers: { 'Content-Type' => 'application/json' })
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .to_return(status: 200, body: tv_response.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'movie と tv の結果を両方返す' do
      results = adapter.search('ファイト・クラブ')
      expect(results.length).to eq(2)
    end

    it '映画のタイトルとIDを正しく返す' do
      results = adapter.search('ファイト・クラブ')
      movie = results.find { |r| r.media_type == 'movie' }
      expect(movie.title).to eq('ファイト・クラブ')
      expect(movie.external_api_id).to eq('550')
    end

    it '映画のAPIソースとカバー画像URLを正しく返す' do
      results = adapter.search('ファイト・クラブ')
      movie = results.find { |r| r.media_type == 'movie' }
      expect(movie.external_api_source).to eq('tmdb')
      expect(movie.cover_image_url).to include('image.tmdb.org')
    end

    it 'tv の結果を drama にマッピングする' do
      results = adapter.search('ブレイキング・バッド')
      drama = results.find { |r| r.media_type == 'drama' }
      expect(drama).to be_present
      expect(drama.title).to eq('ブレイキング・バッド')
    end

    it 'popularity（正規化済み）をmetadataに含める' do
      results = adapter.search('テスト')
      movie = results.find { |r| r.media_type == 'movie' }
      expect(movie.metadata[:popularity]).to be_within(0.01).of(0.615)
    end

    it '結果が0件の場合は空配列を返す' do
      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.search('存在しない作品')).to eq([])
    end

    context '日本のアニメーション作品' do # rubocop:disable RSpec/MultipleMemoizedHelpers
      let(:anime_movie_response) do
        {
          'results' => []
        }
      end

      let(:anime_tv_response) do
        {
          'results' => [
            {
              'id' => 12_345,
              'name' => 'けいおん！',
              'overview' => '軽音部の日常',
              'poster_path' => '/keion.jpg',
              'genre_ids' => [16, 35],
              'original_language' => 'ja',
              'popularity' => 45.0
            },
            {
              'id' => 67_890,
              'name' => 'ブレイキング・バッド',
              'overview' => '化学教師が犯罪に手を染める',
              'poster_path' => '/bb.jpg',
              'genre_ids' => [18],
              'original_language' => 'en',
              'popularity' => 120.0
            },
            {
              'id' => 11_111,
              'name' => 'スポンジ・ボブ',
              'overview' => '海底の冒険',
              'poster_path' => '/sponge.jpg',
              'genre_ids' => [16, 35],
              'original_language' => 'en',
              'popularity' => 80.0
            }
          ]
        }
      end

      before do
        stub_request(:get, %r{api.themoviedb.org/3/search/movie})
          .to_return(status: 200, body: anime_movie_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .to_return(status: 200, body: anime_tv_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '日本のアニメ（Animation + 原語ja）をAniListと重複しないよう除外する' do
        results = adapter.search('けいおん')
        # けいおん！は除外され、ブレイキング・バッドとスポンジ・ボブのみ返る
        expect(results.length).to eq(2)
        titles = results.map(&:title)
        expect(titles).not_to include('けいおん！')
      end

      it '海外のアニメーション（Animation + 原語en）は除外しない' do
        results = adapter.search('スポンジ')
        expect(results.map(&:title)).to include('スポンジ・ボブ')
      end
    end
  end

  describe 'Wikipedia経由フォールバック検索' do
    let(:wikipedia_client) { instance_double(ExternalApis::WikipediaClient) }

    before do
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wikipedia_client)
      stub_request(:get, %r{api.themoviedb.org/3/search/movie})
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    context '結果が3件以下のとき' do
      before do
        # 元クエリ → 0件
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .with(query: hash_including('query' => 'ウォーキングデッド'))
          .to_return(status: 200, body: { 'results' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        # Wikipedia → 正式タイトル取得
        allow(wikipedia_client).to receive(:search).with('ウォーキングデッド', limit: 5).and_return(['ウォーキング・デッド'])
        # 正式タイトルでTMDB再検索 → ヒット
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .with(query: hash_including('query' => 'ウォーキング・デッド'))
          .to_return(status: 200, body: { 'results' => [{
            'id' => 1402, 'name' => 'ウォーキング・デッド',
            'overview' => 'ゾンビが蔓延する世界', 'poster_path' => '/twd.jpg',
            'genre_ids' => [18], 'original_language' => 'en', 'popularity' => 95.0
          }] }.to_json, headers: { 'Content-Type' => 'application/json' })
        stub_request(:get, %r{api.themoviedb.org/3/search/movie})
          .with(query: hash_including('query' => 'ウォーキング・デッド'))
          .to_return(status: 200, body: { 'results' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it 'Wikipedia経由で正式タイトルを取得して追加検索する' do
        results = adapter.search('ウォーキングデッド')
        expect(results.map(&:title)).to include('ウォーキング・デッド')
      end
    end

    context '結果が4件以上のとき' do
      let(:enough_results) do
        4.times.map do |i|
          { 'id' => i + 1, 'name' => "ドラマ#{i}", 'overview' => '説明',
            'poster_path' => '/img.jpg', 'genre_ids' => [], 'original_language' => 'ja',
            'popularity' => 50.0 }
        end
      end

      before do
        allow(wikipedia_client).to receive(:search)
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .to_return(status: 200, body: { 'results' => enough_results }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it 'Wikipedia検索を実行しない' do
        adapter.search('テスト作品')
        expect(wikipedia_client).not_to have_received(:search)
      end
    end

    context 'Wikipediaでヒットしない場合' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .to_return(status: 200, body: { 'results' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        allow(wikipedia_client).to receive(:search).and_return([])
      end

      it 'エラーにならず空配列を返す' do
        results = adapter.search('完全に存在しない作品')
        expect(results).to eq([])
      end
    end

    context 'Wikipediaでエラーが発生した場合' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .to_return(status: 200, body: { 'results' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        allow(wikipedia_client).to receive(:search).and_raise(StandardError, 'Wikipedia API error')
      end

      it 'エラーを握りつぶして元の結果を返す' do
        results = adapter.search('テスト')
        expect(results).to eq([])
      end
    end

    context '重複除去' do
      before do
        same_result = { 'id' => 100, 'name' => 'テスト・ドラマ', 'overview' => '説明',
                        'poster_path' => '/img.jpg', 'genre_ids' => [], 'original_language' => 'ja',
                        'popularity' => 50.0 }
        stub_request(:get, %r{api.themoviedb.org/3/search/tv})
          .to_return(status: 200, body: { 'results' => [same_result] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        allow(wikipedia_client).to receive(:search).and_return(['テスト・ドラマ'])
      end

      it '同じIDの結果は重複しない' do
        results = adapter.search('テストドラマ')
        ids = results.map(&:external_api_id)
        expect(ids.uniq.length).to eq(ids.length)
      end
    end
  end

  describe 'リトライミドルウェア' do
    let(:movie_retry_body) do
      { 'results' => [{ 'id' => 550, 'title' => 'テスト映画', 'overview' => 'テスト概要',
                        'poster_path' => '/test.jpg' }] }
    end

    let(:tv_retry_body) do
      { 'results' => [] }
    end

    it 'サーバーエラー時にリトライして成功する' do
      stub_request(:get, %r{api.themoviedb.org/3/search/movie})
        .to_return(status: 500, body: '{}', headers: { 'Content-Type' => 'application/json' })
        .then.to_return(status: 200, body: movie_retry_body.to_json,
                        headers: { 'Content-Type' => 'application/json' })
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .to_return(status: 200, body: tv_retry_body.to_json,
                   headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('テスト')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('テスト映画')
    end
  end

  describe 'タイムアウト設定' do
    it 'open_timeout と timeout が設定されている' do
      conn = adapter.send(:tmdb_connection)
      expect(conn.options.open_timeout).to eq(5)
      expect(conn.options.timeout).to eq(10)
    end
  end

  describe '#fetch_japanese_description' do
    let(:tmdb_description_response) do
      {
        'results' => [
          {
            'id' => 20_464,
            'name' => 'けいおん！',
            'overview' => '桜が丘高校の軽音部に入部した4人の少女たちの日常',
            'media_type' => 'tv'
          }
        ]
      }
    end

    before do
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: tmdb_description_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'TMDBの日本語概要を返す' do
      description = adapter.fetch_japanese_description('K-ON!')
      expect(description).to eq('桜が丘高校の軽音部に入部した4人の少女たちの日常')
    end

    it 'マッチする作品がない場合はnilを返す' do
      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_japanese_description('存在しない作品')).to be_nil
    end

    it 'API通信エラー時はnilを返す（検索全体を壊さない）' do
      stub_request(:get, /api.themoviedb.org/).to_timeout
      expect(adapter.fetch_japanese_description('テスト')).to be_nil
    end

    it '同名の外国作品より日本語原語の作品を優先する' do
      mixed = { 'results' => [
        { 'media_type' => 'movie', 'original_language' => 'en', 'overview' => 'American SF movie' },
        { 'media_type' => 'tv', 'original_language' => 'ja', 'overview' => '巨人が支配する世界で人類が戦う' }
      ] }
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: mixed.to_json, headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_japanese_description('Attack on Titan')).to eq('巨人が支配する世界で人類が戦う')
    end

    it '日本語原語の結果がない場合は最初のmovie/tvにフォールバックする' do
      english_only = { 'results' => [
        { 'media_type' => 'person' },
        { 'media_type' => 'movie', 'original_language' => 'en', 'overview' => 'An English movie' }
      ] }
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: english_only.to_json, headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_japanese_description('Some Movie')).to eq('An English movie')
    end
  end

  describe '#safe_search' do
    it 'APIエラー時に空配列を返す' do
      stub_request(:get, /api.themoviedb.org/).to_return(status: 500)
      expect(adapter.safe_search('テスト')).to eq([])
    end

    it 'タイムアウト時に空配列を返す' do
      stub_request(:get, /api.themoviedb.org/).to_timeout
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
