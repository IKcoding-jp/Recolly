# frozen_string_literal: true

# 検索結果のカバー画像補完（openBD）と、記録時の日本語説明補完を担当する。
# 説明補完は検索パスから撤去し、記録時に1作品単位で行う（ADR-0044）
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

  # 検索結果のカバー画像を補完する（openBDのみ・説明補完は行わない）
  # ジャケット主体の検索UIでは書影の欠損が目立つため、検索時はここだけ残している
  # limit: HTTP補完の対象件数。nil なら全件
  def enrich_covers(sorted_results, limit: nil)
    targets = limit ? sorted_results.first(limit) : sorted_results
    enrich_books_via_openbd(targets)
    sorted_results
  end

  # 記録時に1作品分の日本語説明を取得してWorkに保存する
  # 補完に失敗しても例外を漏らさない（記録の作成自体は必ず成功させる）
  def enrich_work_description!(work)
    return if work.description.present? && !english_text?(work.description)

    target = build_description_target(work)
    try_enrich_description(target)
    work.update!(description: target.description) if target.description != work.description
  rescue StandardError => e
    Rails.logger.error("[WorkEnrichmentService] 記録時説明補完エラー: #{e.message}")
  end

  private

  # 既存の補完ロジック（タイトル単位キャッシュ含む）を流用するため SearchResult 形式に包む
  # jsonbのmetadataは文字列キーのため、title_english等を参照できるようシンボル化する
  def build_description_target(work)
    ExternalApis::BaseAdapter::SearchResult.new(
      work.title, work.media_type, work.description, nil, nil, nil, nil,
      (work.metadata || {}).symbolize_keys
    )
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

  # 補完の試行順:
  # 1. タイトル+media_type単位キャッシュ（作品をまたいで再利用する）
  # 2. TMDB日本語説明（metadataに title_english/title_romaji があれば順に試す）
  # 3. Wikipedia search_and_fetch_extract（完全一致制約を回避した検索→取得の2段階）
  # 4. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
  #
  # キーに media_type を含める理由: 同一タイトルのアニメ版・漫画版・書籍版等が存在しうるため。
  # media_type を区別しないと、先に補完された方の説明を別media_typeが誤って引き継いでしまう
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
  def resolve_description(japanese_desc, original_desc)
    return japanese_desc if japanese_desc.present?

    original_desc
  end

  # 文字列の半分以上がASCII文字なら英語と判定（補完要否の判定に使用）
  def english_text?(text)
    return false if text.blank?

    ascii_ratio = text.count("\x20-\x7E").to_f / text.length
    ascii_ratio > 0.5
  end
end
