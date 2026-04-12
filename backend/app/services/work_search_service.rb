# frozen_string_literal: true

# 検索パイプラインは fetch → enrich_books → enrich_missing_descriptions →
# share_series_descriptions → sort の順で処理する。各段階を private メソッドとして
# 分割しているため行数は膨らむが、意味のある単位で命名しており責務は単一である。
class WorkSearchService # rubocop:disable Metrics/ClassLength
  CACHE_TTL = 12.hours
  # 実装変更時にインクリメントしてキャッシュを無効化する
  CACHE_VERSION = 'v3'
  ENRICHMENT_BATCH_SIZE = 5

  # 親プレフィックスマッチで親が子の何倍以下の長さなら採用するかの閾値
  # 0.8 = 親が子の長さの80%以下
  # "進撃の巨人"(5) と "進撃の巨人ファン"(8) のような誤マッチを軽減する
  PARENT_PREFIX_RATIO = 0.8

  def search(query, media_type: nil)
    cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"

    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
      adapters = select_adapters(media_type)
      results = fetch_from_adapters_in_parallel(adapters, query, media_type)
      results = results.select { |r| r.media_type == media_type } if media_type.present?

      enrich_books_via_openbd(results)
      enrich_missing_descriptions(results)
      share_series_descriptions(results)
      sort_by_quality_and_popularity(results)
    end
  end

  private

  # クラス定数ではなくメソッドで返す（Zeitwerkのオートロード順序問題を回避）
  # movieにAniListを含める（アニメ映画はTMDBで除外されるためAniList経由で取得）
  def adapter_map
    {
      'movie' => [ExternalApis::TmdbAdapter, ExternalApis::AniListAdapter],
      'drama' => [ExternalApis::TmdbAdapter],
      'anime' => [ExternalApis::AniListAdapter],
      'manga' => [ExternalApis::AniListAdapter],
      'book' => [ExternalApis::GoogleBooksAdapter],
      'game' => [ExternalApis::IgdbAdapter]
    }
  end

  # 複数のアダプターを並列にAPI呼び出しし、結果を統合する
  # 各アダプターのsafe_searchは個別にエラーハンドリング済みのため、
  # 1つのスレッドが失敗しても他のスレッドには影響しない
  # media_type: AniListのtype絞り込みに使用（他のアダプターでは無視される）
  def fetch_from_adapters_in_parallel(adapters, query, media_type)
    threads = adapters.map do |adapter|
      Thread.new { adapter.safe_search(query, media_type: media_type) }
    end
    threads.flat_map(&:value)
  end

  def select_adapters(media_type)
    if media_type.present?
      classes = adapter_map[media_type]
      classes ? classes.map(&:new) : []
    else
      all_adapters
    end
  end

  def all_adapters
    [
      ExternalApis::TmdbAdapter.new,
      ExternalApis::AniListAdapter.new,
      ExternalApis::GoogleBooksAdapter.new,
      ExternalApis::IgdbAdapter.new
    ]
  end

  # Google Booksの結果のうち画像・説明が欠損しているものを openBD で補完する
  # ISBN が metadata にない結果はスキップする（openBDはISBNベース）
  def enrich_books_via_openbd(results)
    book_results = results.select { |r| openbd_enrichment_target?(r) }
    return if book_results.empty?

    book_results.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
      threads = batch.map do |result|
        Thread.new { enrich_single_book(result) }
      end
      threads.each(&:join)
    end
  end

  # openBD 補完対象の判定（google_books由来で画像か説明が欠損しISBNを持つ）
  def openbd_enrichment_target?(result)
    return false unless result.external_api_source == 'google_books'
    return false unless result.cover_image_url.blank? || result.description.blank?

    result.metadata[:isbn].present?
  end

  # スレッドごとに独立したクライアントインスタンスを使用する
  # （Faradayコネクションの共有を避けるため、AniList補完と同じ方針）
  # 欠損している項目だけを補完する（既存データは上書きしない）
  def enrich_single_book(result)
    openbd = ExternalApis::OpenbdClient.new
    data = openbd.fetch(result.metadata[:isbn])
    return if data.nil?

    result.cover_image_url ||= data[:cover_image_url]
    result.description ||= data[:description]
  end

  # 説明が空 or 英語の全結果を対象に日本語説明を補完する
  # 以前は AniList 結果のみが対象だったが、IGDB（ゲーム）・Google Books（本）・TMDB（映画/ドラマ）にも拡張
  # 外部APIへの同時接続数を制限するため、5件ずつのバッチで並列処理する
  def enrich_missing_descriptions(results)
    needs_enrichment = results.select do |r|
      r.description.blank? || english_text?(r.description)
    end
    return if needs_enrichment.empty?

    needs_enrichment.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
      threads = batch.map do |result|
        Thread.new { try_enrich_description(result) }
      end
      threads.each(&:join)
    end
  end

  # 補完の試行順:
  # 1. TMDB日本語説明（映画・ドラマは元々これで取れる。AniList結果は title_english/title_romaji も試す）
  # 2. Wikipedia search_and_fetch_extract（完全一致制約を回避した検索→取得の2段階）
  # 3. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
  def try_enrich_description(result)
    tmdb = ExternalApis::TmdbAdapter.new
    wikipedia = ExternalApis::WikipediaClient.new

    description = fetch_japanese_description_from_tmdb(result, tmdb)
    description ||= wikipedia.search_and_fetch_extract(result.title)
    result.description = resolve_description(description, result.description)
  end

  # TMDBで日本語説明を検索（メタデータにtitle_english/title_romajiがあれば順番に試す）
  def fetch_japanese_description_from_tmdb(result, tmdb)
    queries = [
      result.title,
      result.metadata[:title_english],
      result.metadata[:title_romaji]
    ].compact.uniq

    queries.each do |query|
      description = tmdb.fetch_japanese_description(query)
      return description if description.present?
    end
    nil
  end

  # 日本語説明が見つかればそれを使う。見つからなくても元の説明を消さない（英語でも残す）
  # 以前の remove_english_descriptions は「英語なら nil 化」という破壊的動作だったため廃止
  def resolve_description(japanese_desc, original_desc)
    return japanese_desc if japanese_desc.present?

    original_desc
  end

  # 文字列の半分以上がASCII文字なら英語と判定（補完対象の選定に使用）
  def english_text?(text)
    return false if text.blank?

    ascii_ratio = text.count("\x20-\x7E").to_f / text.length
    ascii_ratio > 0.5
  end

  # シリーズ作品（"進撃の巨人 Season 2" 等）の説明欄が英語のままの場合に、
  # 同じ検索結果リスト内に存在する親作品（"進撃の巨人"）の日本語説明を流用する
  # 各シーズン固有の日本語説明データが世の中に存在しないため、シリーズ全体の概要として使う
  # 流用した結果には metadata[:description_from_parent] = true を付与し、
  # フロント側で「※シリーズ全体の説明」と注釈表示する
  def share_series_descriptions(results)
    parents = build_parent_candidates(results)
    return if parents.empty?

    results.each do |result|
      next unless needs_parent_description?(result)

      parent = find_parent_by_prefix(result, parents)
      next unless parent

      result.description = parent.description
      result.metadata[:description_from_parent] = true
    end
  end

  # 親候補リストを構築する
  # 親の条件: 日本語説明を持っていること
  # （シリーズ識別子の有無は判定しない。プレフィックスマッチで子を検出する）
  def build_parent_candidates(results)
    results.select do |r|
      r.description.present? && !english_text?(r.description)
    end
  end

  # 親説明流用が必要かどうか判定する
  # 説明が空 or 英語の場合のみ補完対象（既に日本語説明があるなら流用しない）
  def needs_parent_description?(result)
    result.description.blank? || english_text?(result.description)
  end

  # 結果に対して、プレフィックスとしてマッチする親候補を探す
  # - 親の正規化タイトルが子の正規化タイトルの先頭部分と完全一致する
  # - 親が子よりも十分短い（親の長さが子の 80% 以下）
  # - 正規表現で series 識別子を列挙するよりも汎用的で、
  #   "進撃の巨人 Season 2", "Re:ゼロ 2nd Season", "HUNTER×HUNTER (2011)",
  #   "HUNTER×HUNTER: Greed Island", "シュタインズ・ゲート ゼロ" 等を包括的に検出できる
  # 複数の親候補がマッチする場合はより詳細（長い）な親を優先する
  def find_parent_by_prefix(result, parents)
    child_norm = normalize_for_parent_match(result.title)
    return nil if child_norm.blank?

    matched = parents.select { |parent| valid_prefix_parent?(parent, result, child_norm) }
    matched.max_by { |parent| normalize_for_parent_match(parent.title).length }
  end

  # 親候補が対象結果のプレフィックス親として成立するか判定する
  def valid_prefix_parent?(parent, result, child_norm)
    return false if parent.equal?(result) # 自分自身は除外

    parent_norm = normalize_for_parent_match(parent.title)
    return false if parent_norm.blank?
    return false if parent_norm == child_norm # 同名の重複は親子関係ではない
    return false unless child_norm.start_with?(parent_norm)

    # 親が子よりも十分短いことを確認（誤マッチ軽減のための閾値）
    parent_norm.length <= child_norm.length * PARENT_PREFIX_RATIO
  end

  # 親マッチ用の表記揺れ吸収（NFKC + 大小文字 + 空白除去）
  def normalize_for_parent_match(text)
    text.unicode_normalize(:nfkc).downcase.gsub(/\s+/, '')
  end

  # 品質スコア（0.0〜1.0）: 画像あり=0.5, 説明あり=0.5
  # 両方ある = 1.0、片方 = 0.5、どちらもない = 0.0
  def quality_score(result)
    score = 0.0
    score += 0.5 if result.cover_image_url.present?
    score += 0.5 if result.description.present?
    score
  end

  # 品質スコア降順 → 人気度降順の2段ソート
  # 情報がしっかりある結果を上位に並べることで、欠損結果を下位に押し下げる
  def sort_by_quality_and_popularity(results)
    results.sort_by do |r|
      [-quality_score(r), -(r.metadata[:popularity] || 0)]
    end
  end
end
