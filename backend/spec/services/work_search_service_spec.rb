# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WorkSearchService, type: :service do
  subject(:service) { described_class.new }

  let(:mock_result) do
    ExternalApis::BaseAdapter::SearchResult.new(
      title: 'テスト作品', media_type: 'anime', description: '説明',
      cover_image_url: nil, total_episodes: 12,
      external_api_id: '1', external_api_source: 'anilist', metadata: {}
    )
  end

  # instance_spy を使いスパイパターン（have_received）でアサーション
  let(:tmdb_double) { instance_spy(ExternalApis::TmdbAdapter) }
  let(:anilist_double) { instance_spy(ExternalApis::AniListAdapter) }
  let(:google_books_double) { instance_spy(ExternalApis::GoogleBooksAdapter) }
  let(:igdb_double) { instance_spy(ExternalApis::IgdbAdapter) }

  before do
    Rails.cache.clear
    allow(ExternalApis::TmdbAdapter).to receive(:new).and_return(tmdb_double)
    allow(ExternalApis::AniListAdapter).to receive(:new).and_return(anilist_double)
    allow(ExternalApis::GoogleBooksAdapter).to receive(:new).and_return(google_books_double)
    allow(ExternalApis::IgdbAdapter).to receive(:new).and_return(igdb_double)
    allow(tmdb_double).to receive(:safe_search).and_return([])
    allow(anilist_double).to receive(:safe_search).and_return([mock_result])
    allow(google_books_double).to receive(:safe_search).and_return([])
    allow(igdb_double).to receive(:safe_search).and_return([])
  end

  describe '#search' do
    it 'ジャンル指定なしで全アダプタに問い合わせる' do
      results = service.search('テスト')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('テスト作品')
    end

    it 'media_type: anime で AniListAdapter のみに問い合わせる' do
      results = service.search('テスト', media_type: 'anime')
      expect(tmdb_double).not_to have_received(:safe_search)
      expect(results.length).to eq(1)
    end

    it 'media_type: movie で TmdbAdapter のみに問い合わせる' do
      service.search('テスト', media_type: 'movie')
      expect(anilist_double).not_to have_received(:safe_search)
    end

    it 'media_type: book で GoogleBooksAdapter のみに問い合わせる' do
      service.search('テスト', media_type: 'book')
      expect(anilist_double).not_to have_received(:safe_search)
    end

    it 'media_type: game で IgdbAdapter のみに問い合わせる' do
      service.search('テスト', media_type: 'game')
      expect(anilist_double).not_to have_received(:safe_search)
    end
  end

  describe 'キャッシュ' do
    # キャッシュ動作テストではメモリストアを使用（test環境のデフォルトは:null_store）
    around do |example|
      original_store = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      example.run
      Rails.cache = original_store
    end

    it '同じクエリの2回目はキャッシュから返す（APIを再呼び出ししない）' do
      service.search('テスト')
      results = service.search('テスト')
      # 2回目はキャッシュから返るため safe_search の呼び出しは1回のみ
      expect(anilist_double).to have_received(:safe_search).exactly(:once)
      expect(results.length).to eq(1)
    end

    it '異なるmedia_typeは別のキャッシュキーを使う' do
      service.search('テスト', media_type: 'anime')
      service.search('テスト', media_type: 'movie')
      # anime（anilist）と movie（tmdb）でそれぞれ1回ずつ呼ばれる
      expect(anilist_double).to have_received(:safe_search).exactly(:once)
      expect(tmdb_double).to have_received(:safe_search).exactly(:once)
    end
  end
end
