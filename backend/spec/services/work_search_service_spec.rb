# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WorkSearchService, type: :service do
  subject(:service) { described_class.new }

  let(:mock_result) do
    ExternalApis::BaseAdapter::SearchResult.new(
      title: 'テスト作品', media_type: 'anime', description: '説明',
      cover_image_url: nil, total_episodes: 12,
      external_api_id: '1', external_api_source: 'anilist', metadata: { popularity: 0.5 }
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
    # instance_spy はnull objectのため、スタブしないと自身を返す
    # enrich_anilist_descriptions で description に spy が入りマーシャリング失敗を防ぐ
    allow(tmdb_double).to receive_messages(safe_search: [], fetch_japanese_description: nil)
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

  describe '人気順ソート' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:low_pop) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'あまり人気ない作品', 'movie', '説明', nil, nil, '10', 'tmdb', { popularity: 0.1 }
      )
    end

    let(:high_pop) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '超人気作品', 'anime', '説明', nil, 12, '20', 'anilist', { popularity: 0.9 }
      )
    end

    let(:mid_pop) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'まあまあ人気', 'game', '説明', nil, nil, '30', 'igdb', { popularity: 0.5 }
      )
    end

    before do
      allow(tmdb_double).to receive(:safe_search).and_return([low_pop])
      allow(anilist_double).to receive(:safe_search).and_return([high_pop])
      allow(igdb_double).to receive(:safe_search).and_return([mid_pop])
    end

    it '結果をpopularity降順でソートする' do
      results = service.search('テスト')
      expect(results.map(&:title)).to eq(%w[超人気作品 まあまあ人気 あまり人気ない作品])
    end
  end

  describe 'AniList日本語説明補完' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:anilist_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人', 'anime', 'In a world ruled by giants...',
        nil, 25, '16498', 'anilist',
        { popularity: 1.0, title_english: 'Attack on Titan', title_romaji: 'Shingeki no Kyojin' }
      )
    end

    before do
      allow(anilist_double).to receive(:safe_search).and_return([anilist_result])
    end

    it 'AniListの英語説明をTMDBの日本語説明に置き換える' do
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('Attack on Titan')
        .and_return('巨人が支配する世界で人類が生き残りをかけて戦う')

      results = service.search('進撃の巨人')
      expect(results.first.description).to eq('巨人が支配する世界で人類が生き残りをかけて戦う')
    end

    it 'TMDBで見つからない場合はAniListの英語説明をそのまま使う' do
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .and_return(nil)

      results = service.search('マイナーアニメ')
      expect(results.first.description).to eq('In a world ruled by giants...')
    end

    it '英語タイトルがない場合はローマ字タイトルで検索する' do # rubocop:disable RSpec/ExampleLength
      no_english = ExternalApis::BaseAdapter::SearchResult.new(
        'シュタインズ・ゲート', 'anime', 'English description',
        nil, 24, '9253', 'anilist',
        { popularity: 0.8, title_romaji: 'Steins;Gate' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([no_english])
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('Steins;Gate')
        .and_return('タイムトラベルSF')

      results = service.search('シュタゲ')
      expect(results.first.description).to eq('タイムトラベルSF')
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
