# frozen_string_literal: true

# 検索パイプライン: fetch(並列) → 一次ソート → 上位N件のみ補完 → 最終ソート
# 補完ロジックは WorkEnrichmentService に分離している。
# enrich: false で補完をスキップした速報結果を返せる（二段階レスポンス・ADR-0042）
class WorkSearchService
  CACHE_TTL = 12.hours
  # 二段階レスポンスで2回目のリクエストが外部API検索をやり直さないための短期キャッシュ
  RAW_CACHE_TTL = 5.minutes
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v7: キャッシュキーのクエリ正規化＋二段階レスポンス導入（v6以前の履歴はgit参照）
  CACHE_VERSION = 'v7'
  # ユーザーが最初に見るのは上位の結果だけなので、重いHTTP補完は上位に限定する
  ENRICHMENT_TOP_N = 20

  Outcome = Struct.new(:results, :enriched)

  # 後方互換API（WorkRecommender等が使用）。常に補完込みの結果を返す
  def search(query, media_type: nil)
    search_with_status(query, media_type: media_type).results
  end

  # enrich: false で補完（openBD・説明・親説明流用）をスキップして即返す
  # フルキャッシュがあれば enrich 指定に関わらず補完済み結果を enriched: true で返す
  def search_with_status(query, media_type: nil, enrich: true)
    cached = Rails.cache.read(full_cache_key(query, media_type))
    return Outcome.new(cached, true) unless cached.nil?
    return Outcome.new(fetch_raw(query, media_type), false) unless enrich

    results = enrich_and_sort(fetch_raw(query, media_type))
    # 外部APIの一時障害で空になった結果を12時間キャッシュしない（1件以上のときのみ書き込む）
    Rails.cache.write(full_cache_key(query, media_type), results, expires_in: CACHE_TTL) if results.any?
    Outcome.new(results, true)
  end

  private

  # 生の検索結果（補完前・一次ソート済み）を取得する
  def fetch_raw(query, media_type)
    key = raw_cache_key(query, media_type)
    cached = Rails.cache.read(key)
    return cached unless cached.nil?

    results = fetch_and_sort(query, media_type)
    Rails.cache.write(key, results, expires_in: RAW_CACHE_TTL) if results.any?
    results
  end

  def fetch_and_sort(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?
    sort_by_quality_and_popularity(results)
  end

  # 補完で説明が付くと品質スコアが変わるため、補完後に最終ソートし直す
  def enrich_and_sort(results)
    WorkEnrichmentService.new.enrich(results, limit: ENRICHMENT_TOP_N)
    sort_by_quality_and_popularity(results)
  end

  def full_cache_key(query, media_type)
    "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{SearchTextNormalizer.normalize(query)}"
  end

  def raw_cache_key(query, media_type)
    "work_search:raw:#{CACHE_VERSION}:#{media_type || 'all'}:#{SearchTextNormalizer.normalize(query)}"
  end

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

  # 品質スコア（0.0〜1.0）: 画像あり=0.5, 説明あり=0.5
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
