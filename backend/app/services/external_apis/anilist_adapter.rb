# frozen_string_literal: true

module ExternalApis
  class AniListAdapter < BaseAdapter
    ENDPOINT = 'https://graphql.anilist.co'

    # GraphQL: anime/manga両方を一括検索（typeパラメータをnullにして絞り込まない）
    SEARCH_QUERY = <<~GRAPHQL
      query ($search: String) {
        Page(perPage: 20) {
          media(search: $search, type: null) {
            id
            title { romaji native english }
            description(asHtml: false)
            coverImage { large }
            episodes
            chapters
            type
            genres
            status
            seasonYear
          }
        }
      }
    GRAPHQL

    def media_types
      %w[anime manga]
    end

    def search(query)
      body = { query: SEARCH_QUERY, variables: { search: query } }
      response = anilist_connection.post(ENDPOINT, body)

      media_list = response.body.dig('data', 'Page', 'media') || []
      media_list.map { |item| normalize(item) }
    end

    private

    def anilist_connection
      @anilist_connection ||= connection(url: ENDPOINT)
    end

    def normalize(item)
      media_type = item['type'] == 'MANGA' ? 'manga' : 'anime'
      # nativeタイトル（日本語）を優先し、なければenglish、romaji の順にフォールバック
      title = item.dig('title', 'native') ||
              item.dig('title', 'english') ||
              item.dig('title', 'romaji')

      SearchResult.new(
        title,
        media_type,
        item['description'],
        item.dig('coverImage', 'large'),
        item['episodes'] || item['chapters'],
        item['id'].to_s,
        'anilist',
        {
          genres: item['genres'],
          status: item['status'],
          season_year: item['seasonYear']
        }.compact
      )
    end
  end
end
