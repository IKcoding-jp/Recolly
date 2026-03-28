# frozen_string_literal: true

module ExternalApis
  class IgdbAdapter < BaseAdapter
    IGDB_URL = 'https://api.igdb.com/v4'
    TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
    IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
    TOKEN_CACHE_KEY = 'igdb_access_token'
    SEARCH_FIELDS = [
      'name', 'summary', 'cover.image_id', 'platforms.name',
      'genres.name', 'first_release_date',
      'alternative_names.name', 'alternative_names.comment',
      'total_rating'
    ].join(',').freeze

    def media_types
      %w[game]
    end

    def search(query)
      sanitized = query.gsub('"', '\\"').gsub(';', '')
      if japanese?(query)
        search_japanese(sanitized)
      else
        search_by_keyword(sanitized)
      end
    end

    private

    # 日本語: IGDB直接検索 + Wikipedia補完を組み合わせる
    def search_japanese(sanitized)
      keyword_results = search_by_keyword(sanitized)
      pattern_results = search_by_pattern(sanitized)
      igdb_results = merge_results(keyword_results, pattern_results)
      wikipedia_results = search_via_wikipedia(sanitized, igdb_results)
      merge_results(igdb_results, wikipedia_results)
    end

    def search_by_keyword(sanitized)
      body = "search \"#{sanitized}\"; fields #{SEARCH_FIELDS}; limit 20;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    def search_by_pattern(sanitized)
      where_clause = "name ~ *\"#{sanitized}\"* | alternative_names.name ~ *\"#{sanitized}\"*"
      body = "fields #{SEARCH_FIELDS}; where #{where_clause}; limit 20;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    def merge_results(primary, secondary)
      seen_ids = primary.to_set(&:external_api_id)
      combined = primary.dup
      secondary.each { |r| combined << r unless seen_ids.include?(r.external_api_id) }
      combined
    end

    def search_via_wikipedia(query, existing_results)
      wikipedia = WikipediaGameAdapter.new
      titles = wikipedia.search_titles(query)
      return [] if titles.empty?

      existing_ids = existing_results.to_set(&:external_api_id)
      titles.filter_map { |jp_title| find_game_via_wikipedia(jp_title, wikipedia, existing_ids) }
    rescue StandardError => e
      Rails.logger.error("[IgdbAdapter] Wikipedia補完エラー: #{e.message}")
      []
    end

    def find_game_via_wikipedia(jp_title, wikipedia, existing_ids)
      match = igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
      return nil if match.nil?

      match.title = jp_title
      match.description = wikipedia.fetch_extract(jp_title).presence || match.description
      existing_ids.add(match.external_api_id)
      match
    end

    # Wikipedia言語間リンクで英語タイトル取得 → IGDBで検索（発売年でリメイク版を区別）
    def igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids = Set.new)
      en_title = wikipedia.fetch_english_title(jp_title)
      return nil unless en_title

      release_year = extract_year_from_title(en_title)
      candidates = search_igdb_candidates(en_title, existing_ids)
      select_best_candidate(candidates, release_year)
    end

    def extract_year_from_title(en_title)
      year_match = en_title.match(/\((\d{4})/)
      year_match && year_match[1].to_i
    end

    def search_igdb_candidates(en_title, existing_ids)
      clean_title = en_title.sub(/\s*\(.*\)\s*$/, '')
      sanitized = clean_title.gsub('"', '\\"').gsub(';', '')
      search_by_keyword(sanitized).reject { |r| existing_ids.include?(r.external_api_id) }
    end

    def select_best_candidate(candidates, release_year)
      return nil if candidates.empty?
      return candidates.first unless release_year

      candidates.find { |r| game_release_year(r) == release_year } || candidates.first
    end

    def game_release_year(result)
      timestamp = result.metadata[:first_release_date]
      timestamp && Time.at(timestamp).utc.year
    end

    def japanese?(text)
      text.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
    end

    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')
      Faraday.new(url: IGDB_URL, request: { open_timeout: 5, timeout: 10 }) do |f|
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504],
                          methods: %i[get head options put delete post]
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.headers['Authorization'] = "Bearer #{token}"
        f.headers['Client-ID'] = client_id
        f.adapter Faraday.default_adapter
      end
    end

    def access_token
      Rails.cache.fetch(TOKEN_CACHE_KEY, expires_in: 50.days) do
        token_connection = Faraday.new do |f|
          f.request :url_encoded
          f.response :json
        end
        credentials = { client_id: ENV.fetch('IGDB_CLIENT_ID'),
                        client_secret: ENV.fetch('IGDB_CLIENT_SECRET'),
                        grant_type: 'client_credentials' }
        response = token_connection.post(TWITCH_TOKEN_URL, credentials)
        token = response.body['access_token']
        raise "Twitch OAuthトークン取得失敗: #{response.body}" unless token

        token
      end
    end

    def japanese_title(item)
      alt_names = item['alternative_names'] || []
      jp = alt_names.find do |a|
        a['comment']&.match?(/Japanese title/i) &&
          a['name']&.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
      end
      jp&.dig('name')
    end

    def normalize_popularity(value)
      return 0.0 unless value

      value.to_f / 100.0
    end

    def normalize(item)
      cover_id = item.dig('cover', 'image_id')

      SearchResult.new(
        japanese_title(item) || item['name'],
        'game',
        item['summary'],
        cover_id ? "#{IMAGE_BASE_URL}/#{cover_id}.jpg" : nil,
        nil,
        item['id'].to_s,
        'igdb',
        {
          platforms: item['platforms']&.pluck('name'),
          genres: item['genres']&.pluck('name'),
          first_release_date: item['first_release_date'],
          popularity: normalize_popularity(item['total_rating'])
        }.compact
      )
    end
  end
end
