# frozen_string_literal: true

module ExternalApis
  class IgdbAdapter < BaseAdapter
    IGDB_URL = 'https://api.igdb.com/v4'
    TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
    IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
    TOKEN_CACHE_KEY = 'igdb_access_token'
    # IGDB regionsテーブルにおける日本のID。game_localizationsから日本語版を特定するのに使う
    REGION_JAPAN = 3
    SEARCH_FIELDS = [
      'name', 'summary', 'cover.image_id', 'platforms.name',
      'genres.name', 'first_release_date',
      'alternative_names.name', 'alternative_names.comment',
      'game_localizations.name', 'game_localizations.region',
      'game_localizations.cover.image_id',
      'total_rating'
    ].join(',').freeze

    def media_types
      %w[game]
    end

    # 日本語クエリではパターン検索を併用する。IGDBのsearchはgame_localizations
    # （日本語版タイトル）を照合しないため、whereでの直接マッチが必要（ADR-0046）
    def search(query, media_type: nil) # rubocop:disable Lint/UnusedMethodArgument -- BaseAdapterインターフェース準拠
      sanitized = query.gsub('"', '\\"').gsub(';', '')
      if japanese?(query)
        merge_results(search_by_keyword(sanitized), search_by_pattern(sanitized))
      else
        search_by_keyword(sanitized)
      end
    end

    private

    def search_by_keyword(sanitized)
      body = "search \"#{sanitized}\"; fields #{SEARCH_FIELDS}; limit 50;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    # 原題・別名・日本語版ローカライズ名のいずれかに部分一致するゲームを探す
    def search_by_pattern(sanitized)
      where_clause = "name ~ *\"#{sanitized}\"* | alternative_names.name ~ *\"#{sanitized}\"* | " \
                     "game_localizations.name ~ *\"#{sanitized}\"*"
      body = "fields #{SEARCH_FIELDS}; where #{where_clause}; limit 50;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    def merge_results(primary, secondary)
      seen_ids = primary.to_set(&:external_api_id)
      combined = primary.dup
      secondary.each { |r| combined << r unless seen_ids.include?(r.external_api_id) }
      combined
    end

    def japanese?(text)
      text.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
    end

    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')
      Faraday.new(url: IGDB_URL, request: { open_timeout: 5, timeout: 10 }) do |f|
        # 5xxのみリトライし、タイムアウト例外ではリトライしない（BaseAdapter#connectionと同じ方針）
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504],
                          exceptions: [Faraday::RetriableResponse], methods: %i[get head options put delete post]
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

    def japanese_localization(item)
      (item['game_localizations'] || []).find { |l| l['region'] == REGION_JAPAN }
    end

    # 表示タイトルの優先順: 日本語版ローカライズ名 → 別名の日本語タイトル → 原題
    # ローカライズ名の方が「Japanese title」コメント頼りの別名より信頼できる
    def japanese_title(item)
      japanese_localization(item)&.dig('name') || japanese_alt_name(item)
    end

    def japanese_alt_name(item)
      alt_names = item['alternative_names'] || []
      jp = alt_names.find do |a|
        a['comment']&.match?(/Japanese title/i) &&
          a['name']&.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
      end
      jp&.dig('name')
    end

    # 日本語版ジャケットがあれば優先する（利用者は日本語版パッケージの見た目に馴染みがある）
    def cover_image_id(item)
      japanese_localization(item)&.dig('cover', 'image_id') || item.dig('cover', 'image_id')
    end

    def normalize_popularity(value)
      return 0.0 unless value

      value.to_f / 100.0
    end

    def normalize(item)
      cover_id = cover_image_id(item)

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
