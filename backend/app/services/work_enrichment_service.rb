# frozen_string_literal: true

# 検索結果の補完（openBD書誌・日本語説明・シリーズ親説明の流用）を担当する。
# HTTPを伴う補完は上位 limit 件に限定できる（検索パフォーマンス改善v2）。
# WorkSearchService から分離した（1ファイル200行ルール対応）
class WorkEnrichmentService
  ENRICHMENT_BATCH_SIZE = 5
  DESCRIPTION_CACHE_PREFIX = 'work_search:desc:v1'
  OPENBD_CACHE_PREFIX = 'work_search:openbd:v1'
  # 作品の説明文・書誌データはほぼ変わらないため長期キャッシュにする
  ENRICHMENT_CACHE_TTL = 30.days
  # 「見つからなかった」は外部APIのデータ追加で変わりうるため短めに再試行させる
  NEGATIVE_CACHE_TTL = 1.day
  # Rails.cache は nil を「キャッシュなし」と区別できないため、未発見を表すマーカー値
  NOT_FOUND = 'NOT_FOUND'

  # sorted_results: 一次ソート済みの全検索結果
  # limit: HTTP補完（openBD・説明）の対象件数。nil なら全件
  # シリーズ親説明の流用はメモリ内処理のため常に全件に適用する
  def enrich(sorted_results, limit: nil)
    targets = limit ? sorted_results.first(limit) : sorted_results
    enrich_books_via_openbd(targets)
    enrich_missing_descriptions(targets)
    share_series_descriptions(sorted_results)
    sorted_results
  end

  private

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

  # 欠損している項目だけを補完する（既存データは上書きしない）
  def enrich_single_book(result)
    data = fetch_openbd_with_cache(result.metadata[:isbn])
    return if data.nil?

    result.cover_image_url ||= data[:cover_image_url]
    result.description ||= data[:description]
  end

  # ISBN単位でopenBD書誌をキャッシュする（説明キャッシュと同じNOT_FOUND方式）
  def fetch_openbd_with_cache(isbn)
    cache_key = "#{OPENBD_CACHE_PREFIX}:#{isbn}"
    cached = Rails.cache.read(cache_key)
    return cached == NOT_FOUND ? nil : cached unless cached.nil?

    data = ExternalApis::OpenbdClient.new.fetch(isbn)
    write_enrichment_cache(cache_key, data)
    data
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
  # 1. タイトル+media_type単位キャッシュ（検索クエリをまたいで再利用する）
  # 2. TMDB日本語説明（映画・ドラマは元々これで取れる。AniList結果は title_english/title_romaji も試す）
  # 3. Wikipedia search_and_fetch_extract（完全一致制約を回避した検索→取得の2段階）
  # 4. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
  #
  # キーに media_type を含める理由: 同一タイトルのアニメ版・漫画版・書籍版等が
  # 同じ検索結果に混在しうる（ジャンル横断アプリの前提）。media_type を区別しないと、
  # 先に処理された方が見つけた説明（自身のtitle_english/title_romaji経由かもしれない）を
  # 別media_typeの結果がキャッシュ経由でそのまま引き継いでしまい、
  # 本来自分自身のメタデータで見つかるはずのより適切な説明を取得する機会を失う
  def try_enrich_description(result)
    cache_key = "#{DESCRIPTION_CACHE_PREFIX}:#{result.media_type}:#{SearchTextNormalizer.normalize(result.title)}"
    cached = Rails.cache.read(cache_key)
    if cached
      result.description = cached unless cached == NOT_FOUND
      return
    end

    description = fetch_description_from_apis(result)
    write_enrichment_cache(cache_key, description)
    result.description = resolve_description(description, result.description)
  end

  # スレッドごとに独立したクライアントインスタンスを使用する
  # （Faradayコネクションの共有を避けるため）
  def fetch_description_from_apis(result)
    tmdb = ExternalApis::TmdbAdapter.new
    wikipedia = ExternalApis::WikipediaClient.new

    description = fetch_japanese_description_from_tmdb(result, tmdb)
    description || wikipedia.search_and_fetch_extract(result.title)
  end

  # 見つかった値は長期、未発見は NOT_FOUND マーカーで短期キャッシュする
  def write_enrichment_cache(cache_key, value)
    if value.present?
      Rails.cache.write(cache_key, value, expires_in: ENRICHMENT_CACHE_TTL)
    else
      Rails.cache.write(cache_key, NOT_FOUND, expires_in: NEGATIVE_CACHE_TTL)
    end
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
  # - 親プレフィックスの直後が「文字/数字」でないこと（境界文字判定）
  #   → "進撃の巨人ファンクラブ" や "FATEstay" のような同単語の続きを別作品として除外する
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
  # 境界文字判定: 親プレフィックスの直後の1文字が letter (\p{L}) または number (\p{N}) なら、
  # 同じ単語の続きと見なし別作品として除外する。
  # OK 例: "進撃の巨人 Season 2"（直後が空白）、"HUNTER×HUNTER: Greed Island"（直後が記号）
  # NG 例: "進撃の巨人ファンクラブ"（直後が "フ" = L）、"FATEstay"（直後が "s" = L）
  def valid_prefix_parent?(parent, result, child_norm)
    return false if parent.equal?(result) # 自分自身は除外

    parent_norm = normalize_for_parent_match(parent.title)
    return false unless prefix_parent_structure_ok?(parent_norm, child_norm)

    boundary_char = child_norm[parent_norm.length]
    !boundary_char&.match?(/[\p{L}\p{N}]/)
  end

  # プレフィックスマッチの構造的条件（親が空でなく、子と同名でなく、子の真のプレフィックスである）
  def prefix_parent_structure_ok?(parent_norm, child_norm)
    return false if parent_norm.blank?
    return false if parent_norm == child_norm
    return false unless child_norm.start_with?(parent_norm)

    child_norm.length > parent_norm.length
  end

  # 親マッチ用の表記揺れ吸収。正規化ロジックは SearchTextNormalizer に集約した
  def normalize_for_parent_match(text)
    SearchTextNormalizer.normalize(text)
  end
end
