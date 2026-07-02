# frozen_string_literal: true

# 検索パイプラインは fetch → enrich（WorkEnrichmentService） → sort の順で処理する。
class WorkSearchService
  CACHE_TTL = 12.hours
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v4: シリーズ親説明流用の境界文字判定を追加（normalize 空白保持 + ratio 廃止）
  # v5: Google Books thumbnail URL を https:// に正規化（Mixed Content 対策 #155）
  # v6: Google Books の langRestrict=ja を廃止しコード側で言語フィルタ
  #     （langRestrict=ja 起因の 503 で空キャッシュされた結果を無効化する）
  CACHE_VERSION = 'v6'

  def search(query, media_type: nil)
    cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"
    cached = Rails.cache.read(cache_key)
    return cached unless cached.nil?

    sorted = fetch_and_process(query, media_type)
    # 外部 API の一時障害（例: Google Books の 5xx）で全アダプタが空配列を返したとき、
    # 空配列を 12 時間キャッシュすると同じ検索が長時間ヒットしない事故になる。
    # ヒットが 1 件以上ある場合のみキャッシュし、空のときは次回再試行させる。
    Rails.cache.write(cache_key, sorted, expires_in: CACHE_TTL) if sorted.any?
    sorted
  end

  private

  def fetch_and_process(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?

    WorkEnrichmentService.new.enrich(results)
    sort_by_quality_and_popularity(results)
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
