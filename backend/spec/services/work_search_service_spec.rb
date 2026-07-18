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
  let(:wiki_double) { instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil) }

  before do
    Rails.cache.clear
    allow(ExternalApis::TmdbAdapter).to receive(:new).and_return(tmdb_double)
    allow(ExternalApis::AniListAdapter).to receive(:new).and_return(anilist_double)
    allow(ExternalApis::GoogleBooksAdapter).to receive(:new).and_return(google_books_double)
    allow(ExternalApis::IgdbAdapter).to receive(:new).and_return(igdb_double)
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
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

    it 'media_type: movie で TmdbAdapter と AniListAdapter に問い合わせる' do
      service.search('テスト', media_type: 'movie')
      expect(tmdb_double).to have_received(:safe_search)
      expect(anilist_double).to have_received(:safe_search)
    end

    it 'media_type: book で GoogleBooksAdapter のみに問い合わせる' do
      service.search('テスト', media_type: 'book')
      expect(anilist_double).not_to have_received(:safe_search)
    end

    it 'media_type: game で IgdbAdapter のみに問い合わせる' do
      service.search('テスト', media_type: 'game')
      expect(anilist_double).not_to have_received(:safe_search)
    end

    it 'media_type指定時にアダプターが返した別ジャンルの結果を除外する' do
      manga_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'manga', 'マンガ版', nil, nil, '2', 'anilist', { popularity: 0.3 }
      )
      anime_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'anime', 'アニメ版', nil, 13, '3', 'anilist', { popularity: 0.7 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([manga_result, anime_result])

      results = service.search('けいおん', media_type: 'anime')
      expect(results.map(&:media_type)).to all(eq('anime'))
      expect(results.length).to eq(1)
    end

    it 'media_type未指定時は全ジャンルの結果を返す' do
      manga_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'manga', 'マンガ版', nil, nil, '2', 'anilist', { popularity: 0.3 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([mock_result, manga_result])

      results = service.search('けいおん')
      expect(results.map(&:media_type)).to contain_exactly('anime', 'manga')
    end

    it 'ジャンル指定なしで全アダプタを並列に呼び出し結果を統合する' do # rubocop:disable RSpec/MultipleExpectations
      movie_result = ExternalApis::BaseAdapter::SearchResult.new(
        'テスト映画', 'movie', '映画の説明', nil, nil, '100', 'tmdb', { popularity: 0.6 }
      )
      allow(tmdb_double).to receive(:safe_search).and_return([movie_result])

      results = service.search('テスト')
      expect(tmdb_double).to have_received(:safe_search).with('テスト', media_type: nil)
      expect(anilist_double).to have_received(:safe_search).with('テスト', media_type: nil)
      expect(google_books_double).to have_received(:safe_search).with('テスト', media_type: nil)
      expect(igdb_double).to have_received(:safe_search).with('テスト', media_type: nil)
      expect(results.length).to eq(2)
    end
  end

  describe '説明補完を行わないこと（ADR-0044）' do
    it '英語説明の結果でもTMDB・Wikipediaの説明補完APIを呼ばない' do
      english_anime = ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人', 'anime', 'In a world ruled by giants...',
        nil, 25, '16498', 'anilist',
        { popularity: 1.0, title_english: 'Attack on Titan' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([english_anime])

      results = service.search('進撃の巨人', media_type: 'anime')

      expect(tmdb_double).not_to have_received(:fetch_japanese_description)
      expect(wiki_double).not_to have_received(:search_and_fetch_extract)
      # 生の説明はそのまま返す（表示するかどうかはフロント側の責務）
      expect(results.first.description).to eq('In a world ruled by giants...')
    end
  end

  describe '#search openBDカバー補完' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:openbd_double) { instance_double(ExternalApis::OpenbdClient) }
    let(:book_without_image) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '人間失格', 'book', nil, nil, nil, 'gbid1', 'google_books',
        { isbn: '9784101001340', popularity: 0.5 }
      )
    end
    let(:book_with_full_data) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ノルウェイの森', 'book', '既存の説明', 'https://existing.jpg',
        nil, 'gbid2', 'google_books',
        { isbn: '9784101001341', popularity: 0.5 }
      )
    end
    let(:book_without_isbn) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '謎の本', 'book', nil, nil, nil, 'gbid3', 'google_books',
        { popularity: 0.5 }
      )
    end

    before do
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(openbd_double)
      allow(google_books_double).to receive(:safe_search).and_return(
        [book_without_image, book_with_full_data, book_without_isbn]
      )
    end

    it 'ISBN がある欠損結果に openBD のデータを補完する' do
      allow(openbd_double).to receive(:fetch).with('9784101001340').and_return(
        { cover_image_url: 'https://openbd.jp/cover.jpg', description: '恥の多い生涯。' }
      )
      results = service.search('本テスト', media_type: 'book')
      target = results.find { |r| r.title == '人間失格' }
      expect(target.cover_image_url).to eq('https://openbd.jp/cover.jpg')
      expect(target.description).to eq('恥の多い生涯。')
    end

    it '既存のデータは openBD で上書きしない' do
      allow(openbd_double).to receive(:fetch).and_return(
        { cover_image_url: 'https://openbd.jp/other.jpg', description: '別の説明' }
      )
      results = service.search('本テスト', media_type: 'book')
      target = results.find { |r| r.title == 'ノルウェイの森' }
      # 既存の画像・説明が維持される
      expect(target.cover_image_url).to eq('https://existing.jpg')
      expect(target.description).to eq('既存の説明')
      # openBD fetch は呼ばれない（欠損がないため）
      expect(openbd_double).not_to have_received(:fetch).with('9784101001341')
    end

    it 'ISBN がない結果は openBD 対象外' do
      allow(openbd_double).to receive(:fetch)
      service.search('本テスト', media_type: 'book')
      # ISBNを持つ結果のfetchは呼ばれる
      expect(openbd_double).to have_received(:fetch).with('9784101001340')
      # ISBNがない結果に対するfetchは呼ばれない
      expect(openbd_double).not_to have_received(:fetch).with(nil)
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

  describe '#search 品質込みソート' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:full_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品A', 'anime', '説明あり', 'https://img.jpg', nil,
        '1', 'anilist', { popularity: 0.3 }
      )
    end
    let(:image_only) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品B', 'anime', nil, 'https://img.jpg', nil,
        '2', 'anilist', { popularity: 0.9 }
      )
    end
    let(:desc_only) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品C', 'anime', '説明あり', nil, nil,
        '3', 'anilist', { popularity: 0.9 }
      )
    end
    let(:empty_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品D', 'anime', nil, nil, nil,
        '4', 'anilist', { popularity: 1.0 }
      )
    end

    before do
      allow(anilist_double).to receive(:safe_search).and_return(
        [empty_result, image_only, desc_only, full_result]
      )
    end

    it '画像+説明ありを最上位、両方なしを最下位に並べる' do
      results = service.search('テスト', media_type: 'anime')
      expect(results.first.title).to eq('作品A') # 画像+説明あり
      expect(results.last.title).to eq('作品D')  # 両方なし
    end

    it '同じ品質レベル内では人気度順に並ぶ' do
      results = service.search('テスト', media_type: 'anime')
      # 画像のみ(popularity=0.9)と説明のみ(popularity=0.9) は同じ品質スコア0.5
      # popularity が同じなので順序は保証されないが、両方がAの後に来る
      mid_titles = [results[1].title, results[2].title]
      expect(mid_titles).to contain_exactly('作品B', '作品C')
    end
  end

  describe '#search 関連度ソート' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:exact_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダ', 'game', nil, nil, nil, '1', 'igdb', { popularity: 0.1 }
      )
    end
    let(:prefix_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダの伝説', 'game', '説明', 'https://img.jpg', nil, '2', 'igdb', { popularity: 0.2 }
      )
    end
    let(:partial_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'リンクの冒険 ゼルダの伝説2', 'game', '説明', 'https://img.jpg', nil, '3', 'igdb',
        { popularity: 0.3 }
      )
    end
    let(:no_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'マリオカート', 'game', '説明', 'https://img.jpg', nil, '4', 'igdb', { popularity: 1.0 }
      )
    end

    before do
      allow(igdb_double).to receive(:safe_search).and_return(
        [no_match, partial_match, prefix_match, exact_match]
      )
    end

    it '人気や品質より関連度ティアを優先して並べる' do
      results = service.search('ゼルダ', media_type: 'game')
      expect(results.map(&:title)).to eq(
        ['ゼルダ', 'ゼルダの伝説', 'リンクの冒険 ゼルダの伝説2', 'マリオカート']
      )
    end

    it '同じ関連度ティア内では品質→人気度の順で並べる' do
      same_tier_low_quality = ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダの伝説 夢をみる島', 'game', nil, nil, nil, '5', 'igdb', { popularity: 0.9 }
      )
      allow(igdb_double).to receive(:safe_search).and_return(
        [same_tier_low_quality, prefix_match]
      )
      results = service.search('ゼルダ', media_type: 'game')
      # 両方とも前方一致ティアだが、画像+説明ありのprefix_matchが品質で勝つ
      expect(results.map(&:title)).to eq(['ゼルダの伝説', 'ゼルダの伝説 夢をみる島'])
    end

    it '関連度・品質・人気度が同点ならシーズン番号昇順で並べる' do # rubocop:disable RSpec/ExampleLength
      season2 = ExternalApis::BaseAdapter::SearchResult.new(
        'コード・ブルー 2nd season', 'game', '説明', 'https://img.jpg', nil,
        '21021-s2', 'igdb', { popularity: 0.3, season_number: 2 }
      )
      season1 = ExternalApis::BaseAdapter::SearchResult.new(
        'コード・ブルー 1st season', 'game', '説明', 'https://img.jpg', nil,
        '21021-s1', 'igdb', { popularity: 0.3, season_number: 1 }
      )
      allow(igdb_double).to receive(:safe_search).and_return([season2, season1])
      results = service.search('コード・ブルー', media_type: 'game')
      expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2])
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

    it 'キャッシュTTLが12時間に設定されている' do
      expect(WorkSearchService::CACHE_TTL).to eq(12.hours)
    end

    it 'キャッシュバージョンがv12である（本検索のラノベ除外で旧キャッシュを無効化）' do
      expect(WorkSearchService::CACHE_VERSION).to eq('v12')
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
      # anime→anilist1回、movie→tmdb1回+anilist1回で、anilistは計2回呼ばれる
      expect(anilist_double).to have_received(:safe_search).twice
      expect(tmdb_double).to have_received(:safe_search).exactly(:once)
    end

    it 'キャッシュキーに CACHE_VERSION を含めることで古い実装のキャッシュを無視する' do
      # 古いフォーマットのキー（v無し）でデータを入れておく
      Rails.cache.write('work_search:anime:テスト', [mock_result])
      # 新しい検索は新しいキー形式で保存される
      service.search('テスト', media_type: 'anime')
      expect(Rails.cache.exist?("work_search:#{WorkSearchService::CACHE_VERSION}:anime:テスト")).to be true
    end

    # 外部 API が一時的に 5xx を返し全アダプタが空配列を返すと、空キャッシュが
    # 12 時間残り同じ検索が常にヒットしない事故を防ぐ。
    it '空の結果はキャッシュせず次回呼び出しで再試行する' do
      allow(anilist_double).to receive(:safe_search).and_return([])
      service.search('一時失敗クエリ', media_type: 'anime')
      service.search('一時失敗クエリ', media_type: 'anime')
      expect(anilist_double).to have_received(:safe_search).twice
      cache_key = "work_search:#{WorkSearchService::CACHE_VERSION}:anime:一時失敗クエリ"
      expect(Rails.cache.exist?(cache_key)).to be false
    end

    it '結果が1件以上あればキャッシュし2回目はアダプタを呼ばない' do
      service.search('ヒットあり', media_type: 'anime')
      service.search('ヒットあり', media_type: 'anime')
      expect(anilist_double).to have_received(:safe_search).exactly(:once)
    end
  end

  describe 'キャッシュキーの正規化' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before { allow(Rails).to receive(:cache).and_return(memory_store) }

    it '末尾空白・大文字の揺れで同じキャッシュにヒットする' do
      service.search('STEINS;GATE', media_type: 'anime')
      service.search('steins;gate ', media_type: 'anime')

      expect(anilist_double).to have_received(:safe_search).once
    end
  end

  describe 'カバー補完の上位N件限定' do
    it '一次ソート上位 ENRICHMENT_TOP_N 件のみを limit として補完に渡す' do
      enrichment = instance_double(WorkEnrichmentService)
      allow(WorkEnrichmentService).to receive(:new).and_return(enrichment)
      allow(enrichment).to receive(:enrich_covers) { |results, **| results }

      service.search('テスト', media_type: 'anime')

      expect(enrichment).to have_received(:enrich_covers)
        .with(anything, limit: WorkSearchService::ENRICHMENT_TOP_N)
    end
  end
end
