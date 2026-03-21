# frozen_string_literal: true

module ExternalApis
  class TmdbAdapter < BaseAdapter
    BASE_URL = 'https://api.themoviedb.org'
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

    def media_types
      %w[movie drama]
    end

    def search(query)
      response = tmdb_connection.get('/3/search/multi',
                                     api_key: ENV.fetch('TMDB_API_KEY'),
                                     query: query,
                                     language: 'ja')

      response.body['results']
              .select { |item| %w[movie tv].include?(item['media_type']) }
              .map { |item| normalize(item) }
    end

    private

    def tmdb_connection
      @tmdb_connection ||= connection(url: BASE_URL)
    end

    def normalize(item)
      SearchResult.new(
        item['title'] || item['name'],
        item['media_type'] == 'tv' ? 'drama' : 'movie',
        item['overview'],
        item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        nil,
        item['id'].to_s,
        'tmdb',
        {
          release_date: item['release_date'] || item['first_air_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average']
        }.compact
      )
    end
  end
end
