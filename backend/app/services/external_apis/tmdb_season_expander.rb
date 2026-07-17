# frozen_string_literal: true

module ExternalApis
  # TMDBのTVシリーズ検索結果をシーズン単位のSearchResultに展開する
  # TMDBはシリーズ1エントリでしか検索ヒットしないため、
  # Recollyの記録単位（シーズン）とのズレをここで吸収する
  class TmdbSeasonExpander
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
    # 展開対象の上限。全件展開すると詳細取得APIコールで検索が遅くなるため、関連度上位に絞る
    EXPAND_LIMIT = 3
    # シーズン構成はほぼ変わらないため長期キャッシュ（enrichmentキャッシュと同方針）
    DETAIL_CACHE_PREFIX = 'work_search:tmdb_tv_detail:v1'
    DETAIL_CACHE_TTL = 30.days

    # connection_factory: 呼ぶたびに新しいFaradayコネクションを返すlambda
    # （Faradayコネクションのスレッド間共有を避けるため。TmdbAdapterと同方針）
    def initialize(query, connection_factory:)
      @query = query
      @connection_factory = connection_factory
    end

    # 関連度の高いドラマの詳細を取得し、複数シーズン作品をシーズン別エントリに置き換える
    # 失敗時は元の結果をそのまま返す（検索全体を落とさない）
    def expand(results)
      targets = select_targets(results)
      return results if targets.empty?

      details = fetch_details_in_parallel(targets)
      replace_with_seasons(results, details)
    rescue StandardError => e
      Rails.logger.error("[TmdbSeasonExpander] シーズン展開エラー: #{e.message}")
      results
    end

    private

    # 関連度ティアPARTIAL以上のドラマを、ティア降順→人気度降順で上位EXPAND_LIMIT件選ぶ
    def select_targets(results)
      results
        .select { |r| r.media_type == 'drama' }
        .select { |r| SearchRelevanceScorer.tier(@query, r.title) >= SearchRelevanceScorer::TIER_PARTIAL }
        .sort_by { |r| [-SearchRelevanceScorer.tier(@query, r.title), -(r.metadata[:popularity] || 0)] }
        .first(EXPAND_LIMIT)
    end

    # シリーズID => 詳細ハッシュ（取得失敗はnil）を並列取得する
    def fetch_details_in_parallel(targets)
      threads = targets.map do |r|
        Thread.new { [r.external_api_id, fetch_detail_with_cache(r.external_api_id)] }
      end
      threads.to_h(&:value)
    end

    # 取得失敗（nil）はキャッシュしない（次回の検索で再試行させる）
    def fetch_detail_with_cache(series_id)
      cache_key = "#{DETAIL_CACHE_PREFIX}:#{series_id}"
      cached = Rails.cache.read(cache_key)
      return cached unless cached.nil?

      detail = fetch_detail(series_id)
      Rails.cache.write(cache_key, detail, expires_in: DETAIL_CACHE_TTL) if detail
      detail
    end

    # /tv/{id} から展開に必要なseasonsだけ抜き出す（失敗時はnil＝展開しないだけ）
    def fetch_detail(series_id)
      response = @connection_factory.call.get("/3/tv/#{series_id}",
                                              api_key: ENV.fetch('TMDB_API_KEY'),
                                              language: 'ja')
      seasons = response.body['seasons']
      return nil unless seasons.is_a?(Array)

      { 'seasons' => seasons }
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbSeasonExpander] 詳細取得エラー(#{series_id}): #{e.message}")
      nil
    end

    # 展開対象のシリーズをシーズンエントリ群に置き換える（結果配列内の位置は維持）
    def replace_with_seasons(results, details)
      results.flat_map do |r|
        seasons = regular_seasons(details[r.external_api_id])
        # 1シーズンのみのシリーズは展開しない（冗長なため）
        next [r] if seasons.length < 2

        seasons.map { |season| build_season_result(r, season) }
      end
    end

    # 特別編（season 0）は雑多な内容が混ざるため通常シーズンのみ対象にする
    def regular_seasons(detail)
      return [] unless detail

      (detail['seasons'] || []).select { |s| s['season_number'].to_i >= 1 }
    end

    # シーズン固有の値がなければシリーズの値にフォールバックする
    # （記録時の説明補完に頼らずとも日本語説明が付くようにする）
    def build_season_result(series, season)
      BaseAdapter::SearchResult.new(
        "#{series.title} #{season['name']}",
        'drama',
        season['overview'].presence || series.description,
        season_poster(season) || series.cover_image_url,
        season['episode_count'],
        "#{series.external_api_id}-s#{season['season_number']}",
        'tmdb',
        season_metadata(series, season)
      )
    end

    def season_poster(season)
      season['poster_path'] ? "#{IMAGE_BASE_URL}#{season['poster_path']}" : nil
    end

    # シリーズのmetadataにシーズン固有の値（release_date・season_number）を上書きする
    def season_metadata(series, season)
      series.metadata.merge(
        release_date: season['air_date'],
        season_number: season['season_number'].to_i
      ).compact
    end
  end
end
