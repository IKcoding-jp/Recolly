# frozen_string_literal: true

module ExternalApis
  class AniListAdapter < BaseAdapter
    ENDPOINT = 'https://graphql.anilist.co'

    # GraphQL: anime/manga両方を一括検索（typeパラメータをnullにして絞り込まない）
    # sort: POPULARITY_DESC で人気順に並べる
    SEARCH_QUERY = <<~GRAPHQL
      query ($search: String) {
        Page(perPage: 20) {
          media(search: $search, isAdult: false, sort: POPULARITY_DESC) {
            id
            title { romaji native english }
            description(asHtml: false)
            coverImage { large }
            episodes
            chapters
            volumes
            type
            format
            genres
            status
            seasonYear
            popularity
          }
        }
      }
    GRAPHQL

    def media_types
      %w[anime manga]
    end

    def search(query)
      body = { query: SEARCH_QUERY, variables: { search: query } }
      response = anilist_connection.post('/', body)

      media_list = response.body.dig('data', 'Page', 'media') || []
      media_list.map { |item| normalize(item) }
    end

    private

    def anilist_connection
      @anilist_connection ||= connection(url: ENDPOINT)
    end

    # AniListのpopularity値を0.0〜1.0に正規化
    def normalize_popularity(value)
      return 0.0 unless value

      [value.to_f / 100_000.0, 1.0].min
    end

    # AniListのtype + formatからRecollyのmedia_typeを判定
    def determine_media_type(item)
      return 'manga' if item['type'] == 'MANGA'
      return 'movie' if item['format'] == 'MOVIE'

      'anime'
    end

    def normalize(item)
      media_type = determine_media_type(item)
      title = item.dig('title', 'native') ||
              item.dig('title', 'english') ||
              item.dig('title', 'romaji')

      SearchResult.new(
        title, media_type, item['description'],
        item.dig('coverImage', 'large'),
        total_episodes_for(item, media_type),
        item['id'].to_s, 'anilist', build_metadata(item)
      )
    end

    # 漫画は volumes（巻数）、それ以外は episodes を使用
    def total_episodes_for(item, media_type)
      if media_type == 'manga'
        item['volumes']
      else
        item['episodes']
      end
    end

    def build_metadata(item)
      {
        genres: item['genres'],
        status: item['status'],
        season_year: item['seasonYear'],
        popularity: normalize_popularity(item['popularity']),
        title_english: item.dig('title', 'english'),
        title_romaji: item.dig('title', 'romaji')
      }.compact
    end
  end
end
