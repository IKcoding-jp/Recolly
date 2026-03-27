# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::TmdbAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:api_key) { 'test_tmdb_key' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('TMDB_API_KEY').and_return(api_key)
  end

  describe '#media_types' do
    it 'movie と drama を返す' do
      expect(adapter.media_types).to eq(%w[movie drama])
    end
  end

  describe '#search' do
    let(:tmdb_response) do
      {
        'results' => [
          {
            'id' => 550,
            'title' => 'ファイト・クラブ',
            'overview' => '空虚な生活を送る男の物語',
            'poster_path' => '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
            'media_type' => 'movie',
            'release_date' => '1999-10-15'
          },
          {
            'id' => 1396,
            'name' => 'ブレイキング・バッド',
            'overview' => '化学教師が犯罪に手を染める',
            'poster_path' => '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
            'media_type' => 'tv',
            'first_air_date' => '2008-01-20'
          },
          {
            'id' => 999,
            'name' => 'ある人物',
            'media_type' => 'person'
          }
        ]
      }
    end

    before do
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: tmdb_response.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'movie と tv の結果を返す（person は除外）' do
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

    it '結果が0件の場合は空配列を返す' do
      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.search('存在しない作品')).to eq([])
    end
  end

  describe 'リトライミドルウェア' do
    let(:retry_success_body) do
      { 'results' => [{ 'id' => 550, 'title' => 'テスト映画', 'overview' => 'テスト概要',
                        'poster_path' => '/test.jpg', 'media_type' => 'movie' }] }
    end

    it 'サーバーエラー時にリトライして成功する' do
      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 500, body: '{}', headers: { 'Content-Type' => 'application/json' })
        .then.to_return(status: 200, body: retry_success_body.to_json,
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
