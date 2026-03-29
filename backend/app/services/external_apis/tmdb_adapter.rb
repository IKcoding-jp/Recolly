# frozen_string_literal: true

module ExternalApis
  class TmdbAdapter < BaseAdapter
    BASE_URL = 'https://api.themoviedb.org'
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
    # TMDBのジャンルID: Animation
    ANIMATION_GENRE_ID = 16

    def media_types
      %w[movie drama]
    end

    def search(query, media_type: nil) # rubocop:disable Lint/UnusedMethodArgument -- BaseAdapterインターフェース準拠
      search_movies(query) + search_tv(query)
    end

    # AniListの結果に対して、TMDBから日本語の説明文を取得する
    # タイトルでTMDBを検索し、最初にマッチしたmovie/tvの日本語overviewを返す
    # 見つからない場合やエラー時はnilを返す（呼び出し元で英語説明をフォールバックに使う）
    def fetch_japanese_description(query)
      response = tmdb_connection.get('/3/search/multi',
                                     api_key: ENV.fetch('TMDB_API_KEY'),
                                     query: query,
                                     language: 'ja')

      results = response.body['results'] || []
      best_match_overview(results)
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbAdapter] 日本語説明取得エラー: #{e.message}")
      nil
    end

    private

    # 日本のアニメーション作品を判定（AniListで取得するため、TMDBからは除外する）
    # genre_ids に Animation(16) が含まれ、かつ原語が日本語の場合はアニメとみなす
    # 日本語原語の作品を優先してoverviewを返す（同名の外国作品との誤マッチを防止）
    def best_match_overview(results)
      candidates = results.select { |item| %w[movie tv].include?(item['media_type']) }
      match = candidates.find { |item| item['original_language'] == 'ja' } || candidates.first
      match&.dig('overview').presence
    end

    # search/movie エンドポイントで映画を検索
    def search_movies(query)
      response = tmdb_connection.get('/3/search/movie',
                                     api_key: ENV.fetch('TMDB_API_KEY'),
                                     query: query,
                                     language: 'ja')
      (response.body['results'] || [])
        .reject { |item| japanese_animation?(item) }
        .map { |item| normalize_movie(item) }
    end

    # search/tv エンドポイントでTV番組を検索
    def search_tv(query)
      response = tmdb_connection.get('/3/search/tv',
                                     api_key: ENV.fetch('TMDB_API_KEY'),
                                     query: query,
                                     language: 'ja')
      (response.body['results'] || [])
        .reject { |item| japanese_animation?(item) }
        .map { |item| normalize_tv(item) }
    end

    def japanese_animation?(item)
      genre_ids = item['genre_ids'] || []
      genre_ids.include?(ANIMATION_GENRE_ID) && item['original_language'] == 'ja'
    end

    def tmdb_connection
      @tmdb_connection ||= connection(url: BASE_URL)
    end

    def normalize_movie(item)
      SearchResult.new(
        item['title'],
        'movie',
        item['overview'],
        item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        nil,
        item['id'].to_s,
        'tmdb',
        {
          release_date: item['release_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average'],
          # TMDBのpopularityは0〜数百の範囲。100で割って0〜1に正規化
          popularity: normalize_popularity(item['popularity'])
        }.compact
      )
    end

    def normalize_tv(item)
      SearchResult.new(
        item['name'],
        'drama',
        item['overview'],
        item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        nil,
        item['id'].to_s,
        'tmdb',
        {
          release_date: item['first_air_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average'],
          # TMDBのpopularityは0〜数百の範囲。100で割って0〜1に正規化
          popularity: normalize_popularity(item['popularity'])
        }.compact
      )
    end

    # TMDBのpopularity値を0.0〜1.0に正規化
    def normalize_popularity(value)
      return 0.0 unless value

      [value.to_f / 100.0, 1.0].min
    end
  end
end
