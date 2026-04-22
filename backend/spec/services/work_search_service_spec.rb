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
    # Wikipedia補完のデフォルト（見つからない場合）
    # Task 6 で fetch_extract から search_and_fetch_extract に切り替えた
    wiki_double = instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil)
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
    # instance_spy はnull objectのため、スタブしないと自身を返す
    # enrich_missing_descriptions で description に spy が入りマーシャリング失敗を防ぐ
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

  describe '#search openBD補完' do # rubocop:disable RSpec/MultipleMemoizedHelpers
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

  describe '人気順ソート' do
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
      # 補完をバイパスするため Wikipedia/TMDB をスタブ
      wiki = instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil)
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki)
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)
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

  describe '英語説明の保持' do
    # Task 6 以降: 破壊的な remove_english_descriptions を廃止し、
    # Wikipedia/TMDBで日本語説明が取れなかった場合は英語をそのまま残す方針に変更した
    it 'IGDB等の英語説明文は補完できなくても元の英語のまま残す' do
      english_game = ExternalApis::BaseAdapter::SearchResult.new(
        'Elden Ring', 'game', 'An action RPG developed by FromSoftware.',
        nil, nil, '119133', 'igdb', { popularity: 0.9 }
      )
      allow(igdb_double).to receive(:safe_search).and_return([english_game])
      allow(anilist_double).to receive(:safe_search).and_return([])

      results = service.search('エルデンリング')
      expect(results.first.description).to eq('An action RPG developed by FromSoftware.')
    end

    it '日本語の説明文はそのまま維持する' do
      japanese_game = ExternalApis::BaseAdapter::SearchResult.new(
        'モンスターハンター', 'game', 'カプコンが開発したアクションゲーム。',
        nil, nil, '1111', 'igdb', { popularity: 0.8 }
      )
      allow(igdb_double).to receive(:safe_search).and_return([japanese_game])
      allow(anilist_double).to receive(:safe_search).and_return([])

      results = service.search('モンハン')
      expect(results.first.description).to eq('カプコンが開発したアクションゲーム。')
    end
  end

  describe 'AniList日本語説明補完' do
    let(:anilist_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人', 'anime', 'In a world ruled by giants...',
        nil, 25, '16498', 'anilist',
        { popularity: 1.0, title_english: 'Attack on Titan', title_romaji: 'Shingeki no Kyojin' }
      )
    end
    # Task 6 で fetch_extract から search_and_fetch_extract に変更
    let(:wikipedia_client_double) do
      instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil)
    end

    before do
      allow(anilist_double).to receive(:safe_search).and_return([anilist_result])
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wikipedia_client_double)
    end

    it 'AniListの英語説明をTMDBの日本語説明に置き換える' do
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('Attack on Titan')
        .and_return('巨人が支配する世界で人類が生き残りをかけて戦う')

      results = service.search('進撃の巨人')
      expect(results.first.description).to eq('巨人が支配する世界で人類が生き残りをかけて戦う')
    end

    # Task 6 で破壊的な英語説明除去を廃止したため、英語が残る方向に期待値を更新
    it 'TMDBでもWikipediaでも見つからない場合は英語説明をそのまま残す' do
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)

      results = service.search('マイナーアニメ')
      expect(results.first.description).to eq('In a world ruled by giants...')
    end

    it '日本語タイトルで見つからない場合、英語→ローマ字の順にフォールバックする' do # rubocop:disable RSpec/ExampleLength
      no_japanese_match = ExternalApis::BaseAdapter::SearchResult.new(
        'シュタインズ・ゲート', 'anime', 'English description',
        nil, 24, '9253', 'anilist',
        { popularity: 0.8, title_romaji: 'Steins;Gate' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([no_japanese_match])
      allow(tmdb_double).to receive(:fetch_japanese_description).with('シュタインズ・ゲート').and_return(nil)
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('Steins;Gate').and_return('タイムトラベルSF')

      results = service.search('シュタゲ')
      expect(results.first.description).to eq('タイムトラベルSF')
    end

    it '日本語タイトル優先でTMDB検索する（英語タイトルの誤マッチを防止）' do
      keion_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'anime', 'K-ON! is a Japanese manga series.',
        nil, 13, '5680', 'anilist',
        { popularity: 0.7, title_english: 'K-ON!', title_romaji: 'K-ON!' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([keion_result])
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('けいおん!').and_return('軽音部の日常を描いた作品')

      results = service.search('けいおん')
      expect(results.first.description).to eq('軽音部の日常を描いた作品')
    end

    context 'TMDBで見つからない場合のWikipedia補完' do
      let(:minor_anime) do
        ExternalApis::BaseAdapter::SearchResult.new(
          'マイナーアニメ', 'anime', 'A minor anime series.',
          nil, 12, '99999', 'anilist',
          { popularity: 0.1, title_english: 'Minor Anime', title_romaji: 'Minor Anime' }
        )
      end

      before do
        allow(anilist_double).to receive(:safe_search).and_return([minor_anime])
        allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)
      end

      # Task 6 で fetch_extract → search_and_fetch_extract に切り替え
      it 'TMDBで見つからない場合、Wikipediaから日本語説明を取得する' do
        allow(wikipedia_client_double).to receive(:search_and_fetch_extract)
          .with('マイナーアニメ').and_return('マイナーアニメは、日本のテレビアニメ作品。')

        results = service.search('マイナーアニメ')
        expect(results.first.description).to eq('マイナーアニメは、日本のテレビアニメ作品。')
      end

      # Task 6 で破壊的な英語除去を廃止したため、英語が残る期待に変更
      it 'TMDBでもWikipediaでも見つからない場合、英語説明を残す' do
        allow(wikipedia_client_double).to receive(:search_and_fetch_extract)
          .with('マイナーアニメ').and_return(nil)

        results = service.search('マイナーアニメ')
        expect(results.first.description).to eq('A minor anime series.')
      end
    end

    # Task 6 で破壊的な英語除去を廃止したため、英語が残る期待に変更
    it '日本語説明が見つからなかった場合、英語説明をそのまま残す' do
      english_anime = ExternalApis::BaseAdapter::SearchResult.new(
        'マイナーOVA', 'anime', 'This is a minor OVA episode.',
        nil, 1, '88888', 'anilist',
        { popularity: 0.05, title_english: 'Minor OVA', title_romaji: 'Minor OVA' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([english_anime])
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)

      results = service.search('マイナーOVA')
      expect(results.first.description).to eq('This is a minor OVA episode.')
    end

    context '複数AniList結果の並列補完' do # rubocop:disable RSpec/MultipleMemoizedHelpers
      let(:result_a) do
        ExternalApis::BaseAdapter::SearchResult.new(
          '作品A', 'anime', 'English desc A',
          nil, 12, '100', 'anilist',
          { popularity: 0.8, title_english: 'Work A', title_romaji: 'Work A' }
        )
      end

      let(:result_b) do
        ExternalApis::BaseAdapter::SearchResult.new(
          '作品B', 'anime', 'English desc B',
          nil, 24, '200', 'anilist',
          { popularity: 0.6, title_english: 'Work B', title_romaji: 'Work B' }
        )
      end

      before do
        allow(anilist_double).to receive(:safe_search).and_return([result_a, result_b])
        allow(tmdb_double).to receive(:fetch_japanese_description)
          .with('作品A').and_return('作品Aの日本語説明')
        allow(tmdb_double).to receive(:fetch_japanese_description)
          .with('Work A').and_return(nil)
        allow(tmdb_double).to receive(:fetch_japanese_description)
          .with('作品B').and_return('作品Bの日本語説明')
        allow(tmdb_double).to receive(:fetch_japanese_description)
          .with('Work B').and_return(nil)
      end

      it '複数のAniList結果をすべて日本語補完する' do
        results = service.search('作品')
        descriptions = results.map(&:description)
        expect(descriptions).to contain_exactly('作品Aの日本語説明', '作品Bの日本語説明')
      end
    end
  end

  describe '#search 全ソース対象のWikipedia補完' do
    let(:wiki_double) { instance_double(ExternalApis::WikipediaClient) }
    let(:igdb_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'Zelda', 'game', 'An action-adventure game series.', 'https://img.igdb', nil,
        'g1', 'igdb', { popularity: 0.9 }
      )
    end
    let(:google_book_without_desc) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '嫌われる勇気', 'book', nil, 'https://img.gbooks', nil,
        'gb1', 'google_books', { isbn: '9784478025819', popularity: 0.8 }
      )
    end

    before do
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(
        instance_double(ExternalApis::OpenbdClient, fetch: nil)
      )
    end

    it 'IGDB（ゲーム）の英語説明も Wikipedia 補完の対象になる' do
      allow(wiki_double).to receive(:search_and_fetch_extract).with('Zelda')
                                                              .and_return('ゼルダの伝説はアクションアドベンチャーゲーム。')
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      expect(results.first.description).to eq('ゼルダの伝説はアクションアドベンチャーゲーム。')
    end

    it 'Google Books の空説明も Wikipedia 補完の対象になる' do
      allow(wiki_double).to receive(:search_and_fetch_extract).with('嫌われる勇気')
                                                              .and_return('嫌われる勇気はアドラー心理学の入門書。')
      allow(google_books_double).to receive(:safe_search).and_return([google_book_without_desc])

      results = service.search('嫌われる勇気', media_type: 'book')
      expect(results.first.description).to eq('嫌われる勇気はアドラー心理学の入門書。')
    end

    it 'Wikipedia で見つからず英語しかない場合は英語説明を残す' do
      allow(wiki_double).to receive(:search_and_fetch_extract).and_return(nil)
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      # nil にはならず、元の英語説明が残る（破壊的削除の廃止）
      expect(results.first.description).to eq('An action-adventure game series.')
    end

    it 'TMDBで日本語説明が取れれば Wikipedia を呼ばない' do
      # TMDBアダプタのフェッチをモック
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return('ゲーム日本語説明')
      allow(wiki_double).to receive(:search_and_fetch_extract)
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      expect(results.first.description).to eq('ゲーム日本語説明')
      expect(wiki_double).not_to have_received(:search_and_fetch_extract)
    end
  end

  describe '#search シリーズ親説明流用' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:parent_with_japanese) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人', 'anime', '繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。',
        'https://img.parent', 25, '1', 'anilist', { popularity: 1.0 }
      )
    end
    let(:season2_english) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人 Season 2', 'anime', 'Eren Jaeger swore to wipe out every last Titan.',
        'https://img.s2', 12, '2', 'anilist', { popularity: 0.9 }
      )
    end
    let(:final_season_english) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人 The Final Season', 'anime', 'It has been four years since the Scout Regiment.',
        'https://img.fs', 16, '3', 'anilist', { popularity: 0.8 }
      )
    end
    let(:gaiden_english) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人 外伝 悔いなき選択', 'anime', 'This prequel to megahit Attack on Titan.',
        nil, 2, '4', 'anilist', { popularity: 0.5 }
      )
    end

    before do
      # Wikipedia/TMDB 補完はバイパス（親の日本語は既に取れている前提）
      wiki = instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil)
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki)
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)
      allow(anilist_double).to receive(:safe_search).and_return(
        [parent_with_japanese, season2_english, final_season_english, gaiden_english]
      )
    end

    it 'シリーズ子の英語説明を親の日本語説明で流用する' do
      results = service.search('進撃の巨人', media_type: 'anime')
      season2 = results.find { |r| r.title == '進撃の巨人 Season 2' }
      expect(season2.description).to eq('繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。')
    end

    it '流用した子に metadata[:description_from_parent] = true を付与する' do
      results = service.search('進撃の巨人', media_type: 'anime')
      season2 = results.find { |r| r.title == '進撃の巨人 Season 2' }
      expect(season2.metadata[:description_from_parent]).to be true
    end

    it '親自身は流用対象にならない（自分の説明を保持し、フラグも付かない）' do
      results = service.search('進撃の巨人', media_type: 'anime')
      parent = results.find { |r| r.title == '進撃の巨人' }
      expect(parent.description).to eq('繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。')
      expect(parent.metadata[:description_from_parent]).to be_nil
    end

    it 'The Final Season や 外伝 など複数のシリーズ識別子パターンで流用する' do
      results = service.search('進撃の巨人', media_type: 'anime')
      final = results.find { |r| r.title == '進撃の巨人 The Final Season' }
      gaiden = results.find { |r| r.title == '進撃の巨人 外伝 悔いなき選択' }
      expect(final.description).to eq('繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。')
      expect(gaiden.description).to eq('繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。')
    end

    it '親が結果に含まれない場合は流用せず英語のまま残す' do
      allow(anilist_double).to receive(:safe_search).and_return([season2_english])
      results = service.search('進撃の巨人 Season 2', media_type: 'anime')
      expect(results.first.description).to eq('Eren Jaeger swore to wipe out every last Titan.')
      expect(results.first.metadata[:description_from_parent]).to be_nil
    end

    it '親の説明が英語のままの場合は流用しない' do
      english_parent = ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人', 'anime', 'A massive series of giants threatening humanity.',
        nil, 25, '1', 'anilist', { popularity: 1.0 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([english_parent, season2_english])
      results = service.search('進撃の巨人', media_type: 'anime')
      season2 = results.find { |r| r.title == '進撃の巨人 Season 2' }
      expect(season2.description).to eq('Eren Jaeger swore to wipe out every last Titan.')
      expect(season2.metadata[:description_from_parent]).to be_nil
    end

    it '既に日本語説明を持つ子（Season 3 等）は流用しない' do
      season3_japanese = ExternalApis::BaseAdapter::SearchResult.new(
        '進撃の巨人 Season 3', 'anime', '母親の命を奪った巨人を駆逐するため戦う。',
        nil, 22, '5', 'anilist', { popularity: 0.85 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([parent_with_japanese, season3_japanese])
      results = service.search('進撃の巨人', media_type: 'anime')
      season3 = results.find { |r| r.title == '進撃の巨人 Season 3' }
      # 既存の日本語説明が保持される
      expect(season3.description).to eq('母親の命を奪った巨人を駆逐するため戦う。')
      expect(season3.metadata[:description_from_parent]).to be_nil
    end

    # プレフィックスマッチで対応する幅広いシリーズパターンを検証する
    # ビルダーで SearchResult 生成を 1 行化し、例あたりの行数を抑えて RSpec/ExampleLength を満たす
    # rubocop:disable RSpec/MultipleMemoizedHelpers
    context 'プレフィックスマッチによる幅広いシリーズ識別子対応' do
      def build_result(title, description, popularity)
        ExternalApis::BaseAdapter::SearchResult.new(
          title, 'anime', description, nil, 12, SecureRandom.hex(4), 'anilist', { popularity: popularity }
        )
      end

      def stub_anilist_with(results)
        allow(anilist_double).to receive(:safe_search).and_return(results)
      end

      it '"2nd Season" のような英語序数パターンも流用する' do
        parent = build_result('Re:ゼロから始める異世界生活', '無力な少年が手にしたのは、死して時間を巻き戻す力。', 1.0)
        child = build_result('Re:ゼロから始める異世界生活 2nd Season', 'Even after dying countless times, Subaru.', 0.9)
        stub_anilist_with([parent, child])
        matched = service.search('Re:ゼロ', media_type: 'anime').find { |r| r.title.include?('2nd Season') }
        expect(matched.description).to eq('無力な少年が手にしたのは、死して時間を巻き戻す力。')
        expect(matched.metadata[:description_from_parent]).to be true
      end

      it '年号サフィックス（HUNTER×HUNTER (2011) 等）も流用する' do
        parent = build_result('HUNTER×HUNTER', 'ハンターと呼ばれる人々がいる。', 0.9)
        remake = build_result('HUNTER×HUNTER (2011)', 'A new adaption of the manga.', 1.0)
        stub_anilist_with([parent, remake])
        matched = service.search('HUNTER×HUNTER', media_type: 'anime').find { |r| r.title == 'HUNTER×HUNTER (2011)' }
        expect(matched.description).to eq('ハンターと呼ばれる人々がいる。')
      end

      it 'コロン区切りサブタイトル（HUNTER×HUNTER: Greed Island 等）も流用する' do
        parent = build_result('HUNTER×HUNTER', 'ハンターと呼ばれる人々がいる。', 0.9)
        arc = build_result('HUNTER×HUNTER: Greed Island', 'After the battle with the Spiders.', 0.5)
        stub_anilist_with([parent, arc])
        matched = service.search('HUNTER×HUNTER', media_type: 'anime').find { |r| r.title.include?('Greed Island') }
        expect(matched.description).to eq('ハンターと呼ばれる人々がいる。')
      end

      it '任意の日本語サブタイトル（横行跋扈のポリオマニア 等）も流用する' do
        parent = build_result('シュタインズ・ゲート', '岡部倫太郎が時間軸を巡る物語。', 1.0)
        spinoff = build_result('シュタインズ・ゲート 横行跋扈のポリオマニア', 'Special episode included.', 0.3)
        stub_anilist_with([parent, spinoff])
        matched = service.search('シュタインズ・ゲート', media_type: 'anime').find { |r| r.title.include?('横行跋扈') }
        expect(matched.description).to eq('岡部倫太郎が時間軸を巡る物語。')
      end

      it '親が複数候補ある場合、より長くマッチする親を優先する' do
        short_parent = build_result('進撃の', '短い親の説明', 0.5)
        long_parent = build_result('進撃の巨人', '長い親の正しい説明', 1.0)
        child = build_result('進撃の巨人 Season 2', 'English desc', 0.9)
        stub_anilist_with([short_parent, long_parent, child])
        matched = service.search('進撃の巨人', media_type: 'anime').find { |r| r.title == '進撃の巨人 Season 2' }
        expect(matched.description).to eq('長い親の正しい説明')
      end
    end
    # rubocop:enable RSpec/MultipleMemoizedHelpers

    # 親プレフィックスの直後が文字/数字の場合は同じ単語の続きと見なし別作品として除外する
    # ratio 閾値（廃止）の代わりに境界文字判定で誤マッチを防ぐ
    # rubocop:disable RSpec/MultipleMemoizedHelpers
    context 'プレフィックスマッチの誤マッチ防止（境界文字判定）' do
      def build_result(title, description, popularity)
        ExternalApis::BaseAdapter::SearchResult.new(
          title, 'anime', description, nil, 12, SecureRandom.hex(4), 'anilist', { popularity: popularity }
        )
      end

      def stub_anilist_with(results)
        allow(anilist_double).to receive(:safe_search).and_return(results)
      end

      it '親直後が日本語文字続きの場合は流用しない（進撃の巨人 → 進撃の巨人ファンクラブ）' do
        parent = build_result('進撃の巨人', '繁栄を築き上げた人類は巨人により滅亡の淵に立たされた。', 1.0)
        fanclub = build_result('進撃の巨人ファンクラブ', 'A fan club for Attack on Titan.', 0.1)
        stub_anilist_with([parent, fanclub])
        results = service.search('進撃の巨人', media_type: 'anime')
        fc = results.find { |r| r.title == '進撃の巨人ファンクラブ' }
        expect(fc.description).to eq('A fan club for Attack on Titan.')
        expect(fc.metadata[:description_from_parent]).to be_nil
      end

      it '親直後が英文字の場合は流用しない（FATE → FATEstay）' do
        parent = build_result('FATE', 'フェイト本編の日本語説明', 1.0)
        other = build_result('FATEstay', 'Different work entirely', 0.5)
        stub_anilist_with([parent, other])
        results = service.search('FATE', media_type: 'anime')
        o = results.find { |r| r.title == 'FATEstay' }
        expect(o.description).to eq('Different work entirely')
        expect(o.metadata[:description_from_parent]).to be_nil
      end

      it '親直後が日本語文字続きの場合は流用しない（呪術 → 呪術廻戦）' do
        parent = build_result('呪術', '呪術の解説', 0.3)
        other = build_result('呪術廻戦', 'Jujutsu Kaisen English description', 1.0)
        stub_anilist_with([parent, other])
        results = service.search('呪術', media_type: 'anime')
        o = results.find { |r| r.title == '呪術廻戦' }
        expect(o.description).to eq('Jujutsu Kaisen English description')
        expect(o.metadata[:description_from_parent]).to be_nil
      end

      it '親直後が記号（":"）の場合は流用する（HUNTER×HUNTER → HUNTER×HUNTER: Greed Island）' do
        parent = build_result('HUNTER×HUNTER', 'ハンターと呼ばれる人々がいる。', 0.9)
        arc = build_result('HUNTER×HUNTER: Greed Island', 'After the battle.', 0.5)
        stub_anilist_with([parent, arc])
        results = service.search('HUNTER×HUNTER', media_type: 'anime')
        a = results.find { |r| r.title == 'HUNTER×HUNTER: Greed Island' }
        expect(a.description).to eq('ハンターと呼ばれる人々がいる。')
      end

      it '長尺タイトル（13字以上）でも短いシリーズ識別子が付けば流用する（PARENT_PREFIX_RATIO 廃止の検証）' do
        parent = build_result('転生したらスライムだった件', '転生したスライムが異世界で...', 1.0)
        season2 = build_result('転生したらスライムだった件 第2期', 'Slime continues his journey.', 0.9)
        stub_anilist_with([parent, season2])
        results = service.search('スライム', media_type: 'anime')
        s2 = results.find { |r| r.title.include?('第2期') }
        expect(s2.description).to eq('転生したスライムが異世界で...')
        expect(s2.metadata[:description_from_parent]).to be true
      end
    end
    # rubocop:enable RSpec/MultipleMemoizedHelpers
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
end
