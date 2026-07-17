# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::TmdbSeasonExpander, type: :service do
  subject(:expander) { described_class.new(query, connection_factory: factory) }

  let(:query) { 'コード・ブルー' }
  # スレッドごとに新しいコネクションを作る想定のfactory（WebMockが横取りするため実接続はしない）
  let(:factory) do
    lambda do
      Faraday.new(url: 'https://api.themoviedb.org') do |f|
        f.request :json
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
  end

  let(:series) do
    ExternalApis::BaseAdapter::SearchResult.new(
      'コード・ブルー　ドクターヘリ緊急救命', 'drama', 'シリーズの説明',
      'https://image.tmdb.org/t/p/w500/series.jpg', nil, '21021', 'tmdb',
      { release_date: '2008-07-03', original_language: 'ja', vote_average: 7.4, popularity: 0.3 }
    )
  end

  let(:detail_body) do
    {
      'seasons' => [
        { 'season_number' => 0, 'name' => '特別編', 'air_date' => '2009-01-10',
          'episode_count' => 7, 'overview' => '', 'poster_path' => '/sp.jpg' },
        { 'season_number' => 1, 'name' => '1st season', 'air_date' => '2008-07-03',
          'episode_count' => 11, 'overview' => '1期の説明', 'poster_path' => '/s1.jpg' },
        { 'season_number' => 2, 'name' => '2nd season', 'air_date' => '2010-01-11',
          'episode_count' => 11, 'overview' => '', 'poster_path' => nil }
      ]
    }
  end

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('TMDB_API_KEY').and_return('test_tmdb_key')
    stub_request(:get, %r{api.themoviedb.org/3/tv/21021})
      .to_return(status: 200, body: detail_body.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#expand' do
    it '複数シーズンのシリーズをシーズン別エントリに展開する' do
      results = expander.expand([series])
      expect(results.length).to eq(2)
      expect(results.map(&:title)).to eq(
        ['コード・ブルー　ドクターヘリ緊急救命 1st season',
         'コード・ブルー　ドクターヘリ緊急救命 2nd season']
      )
    end

    it 'external_api_id を {シリーズID}-s{シーズン番号} 形式にする' do
      results = expander.expand([series])
      expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2])
    end

    it '特別編（season 0）は展開対象に含めない' do
      results = expander.expand([series])
      expect(results.map(&:title)).not_to include(a_string_including('特別編'))
    end

    it 'シーズンのoverview・poster・air_date・episode_countを各エントリに設定する' do # rubocop:disable RSpec/MultipleExpectations
      s1 = expander.expand([series]).first
      expect(s1.description).to eq('1期の説明')
      expect(s1.cover_image_url).to eq('https://image.tmdb.org/t/p/w500/s1.jpg')
      expect(s1.metadata[:release_date]).to eq('2008-07-03')
      expect(s1.total_episodes).to eq(11)
      expect(s1.metadata[:season_number]).to eq(1)
    end

    it 'シーズンのoverview・posterが空ならシリーズの値にフォールバックする' do
      s2 = expander.expand([series]).last
      expect(s2.description).to eq('シリーズの説明')
      expect(s2.cover_image_url).to eq('https://image.tmdb.org/t/p/w500/series.jpg')
    end

    it 'シリーズのpopularity等のmetadataを引き継ぐ' do
      s1 = expander.expand([series]).first
      expect(s1.metadata[:popularity]).to eq(0.3)
      expect(s1.metadata[:original_language]).to eq('ja')
    end

    context '通常シーズンが1つだけの場合' do
      let(:detail_body) do
        { 'seasons' => [
          { 'season_number' => 1, 'name' => '1st season', 'air_date' => '2008-07-03',
            'episode_count' => 11, 'overview' => '説明', 'poster_path' => '/s1.jpg' }
        ] }
      end

      it '展開せずシリーズエントリのまま返す' do
        results = expander.expand([series])
        expect(results).to eq([series])
      end
    end

    context '展開対象の選定' do
      let(:unrelated_drama) do
        ExternalApis::BaseAdapter::SearchResult.new(
          '全く関係ないドラマ', 'drama', '説明', nil, nil, '999', 'tmdb', { popularity: 0.9 }
        )
      end
      let(:movie) do
        ExternalApis::BaseAdapter::SearchResult.new(
          'コード・ブルー関連映画', 'movie', '説明', nil, nil, '888', 'tmdb', { popularity: 0.5 }
        )
      end

      it '検索語にマッチしないドラマとmovieは詳細取得せずそのまま返す' do
        results = expander.expand([series, unrelated_drama, movie])
        expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2 999 888])
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/999})).not_to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/888})).not_to have_been_made
      end

      it '関連度の高い上位3件のみ詳細を取得する' do # rubocop:disable RSpec/ExampleLength
        # コード・ブルーを含むドラマを4件用意し、popularity最下位の1件が対象外になることを確認
        candidates = (1..4).map do |i|
          ExternalApis::BaseAdapter::SearchResult.new(
            "コード・ブルー #{i}", 'drama', '説明', nil, nil, i.to_s, 'tmdb',
            { popularity: 1.0 - (i * 0.1) }
          )
        end
        stub_request(:get, %r{api.themoviedb.org/3/tv/\d+})
          .to_return(status: 200, body: { 'seasons' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        expander.expand(candidates)
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/1})).to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/3})).to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/4})).not_to have_been_made
      end
    end

    context '詳細取得が失敗した場合' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/tv/21021}).to_timeout
      end

      it 'シリーズエントリのまま返す（検索全体を落とさない）' do
        results = expander.expand([series])
        expect(results).to eq([series])
      end
    end

    context '詳細取得のレスポンスボディが空だった場合' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/tv/21021})
          .to_return(status: 200, body: 'null', headers: { 'Content-Type' => 'application/json' })
      end

      it 'シリーズエントリのまま返す（検索全体を落とさない）' do
        results = expander.expand([series])
        expect(results).to eq([series])
      end

      it '他の展開対象シリーズは巻き込まれず正常に展開される' do # rubocop:disable RSpec/ExampleLength
        other_series = ExternalApis::BaseAdapter::SearchResult.new(
          'コード・ブルー2', 'drama', 'シリーズ2の説明',
          'https://image.tmdb.org/t/p/w500/series2.jpg', nil, '21022', 'tmdb',
          { popularity: 0.2 }
        )
        stub_request(:get, %r{api.themoviedb.org/3/tv/21022})
          .to_return(status: 200, body: detail_body.to_json,
                     headers: { 'Content-Type' => 'application/json' })

        results = expander.expand([series, other_series])

        expect(results.first).to eq(series)
        expect(results.drop(1).map(&:external_api_id)).to eq(%w[21022-s1 21022-s2])
      end
    end

    context 'キャッシュ' do
      # test環境のデフォルトは:null_storeのためメモリストアに差し替える
      around do |example|
        original_store = Rails.cache
        Rails.cache = ActiveSupport::Cache::MemoryStore.new
        example.run
        Rails.cache = original_store
      end

      it '同じシリーズの2回目は詳細APIを呼ばない' do
        expander.expand([series])
        described_class.new(query, connection_factory: factory).expand([series])
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/21021})).to have_been_made.once
      end

      it '取得失敗はキャッシュしない（次回再試行する）' do
        stub_request(:get, %r{api.themoviedb.org/3/tv/21021})
          .to_timeout.then
          .to_return(status: 200, body: detail_body.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        expander.expand([series])
        results = described_class.new(query, connection_factory: factory).expand([series])
        expect(results.length).to eq(2)
      end
    end
  end
end
