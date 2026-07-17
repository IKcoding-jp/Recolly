# frozen_string_literal: true

# 検索パイプライン: fetch(並列) → 一次ソート → 上位N件のみカバー補完(openBD) → 最終ソート
# 説明補完は検索パスから撤去し、記録時に1作品単位で行う（ADR-0044）
class WorkSearchService
  CACHE_TTL = 12.hours
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v9: 関連度ティアソート導入・ゲーム検索のWikipedia補完軽量化（v8以前の履歴はgit参照）
  CACHE_VERSION = 'v9'
  # ユーザーが最初に見るのは上位の結果だけなので、HTTP補完は上位に限定する
  ENRICHMENT_TOP_N = 20

  def search(query, media_type: nil)
    key = cache_key(query, media_type)
    cached = Rails.cache.read(key)
    return cached unless cached.nil?

    results = enrich_covers_and_sort(fetch_and_sort(query, media_type), query)
    # 外部APIの一時障害で空になった結果を12時間キャッシュしない（1件以上のときのみ書き込む）
    Rails.cache.write(key, results, expires_in: CACHE_TTL) if results.any?
    results
  end

  private

  def fetch_and_sort(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?
    sort_results(results, query)
  end

  # 補完で書影が付くと品質スコアが変わるため、補完後に最終ソートし直す
  def enrich_covers_and_sort(results, query)
    WorkEnrichmentService.new.enrich_covers(results, limit: ENRICHMENT_TOP_N)
    sort_results(results, query)
  end

  def cache_key(query, media_type)
    "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{SearchTextNormalizer.normalize(query)}"
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

  # 関連度ティア降順 → 品質スコア降順 → 人気度降順の3段ソート（ADR-0045）
  # 検索語にマッチする作品を上位に固め、同ティア内では情報が揃った人気作を先に出す
  def sort_results(results, query)
    results.sort_by do |r|
      [-SearchRelevanceScorer.tier(query, r.title), -quality_score(r),
       -(r.metadata[:popularity] || 0)]
    end
  end
end
