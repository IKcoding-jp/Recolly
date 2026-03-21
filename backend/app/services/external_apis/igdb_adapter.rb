# frozen_string_literal: true

module ExternalApis
  class IgdbAdapter < BaseAdapter
    IGDB_URL = 'https://api.igdb.com/v4'
    TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
    IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
    # キャッシュキーにクライアントIDを含めて複数環境での衝突を防ぐ
    TOKEN_CACHE_KEY = 'igdb_access_token'
    SEARCH_FIELDS = 'name,summary,cover.image_id,platforms.name,genres.name,' \
      'first_release_date,alternative_names.name,alternative_names.comment'

    def media_types
      %w[game]
    end

    def search(query)
      sanitized = query.gsub('"', '\\"').gsub(';', '')
      body = if japanese?(query)
               # IGDBは日本語の全文検索に非対応のため、alternative_names（ローカライズ名）で検索
               "fields #{SEARCH_FIELDS}; where alternative_names.name ~ *\"#{sanitized}\"*; limit 20;"
             else
               "search \"#{sanitized}\"; fields #{SEARCH_FIELDS}; limit 20;"
             end
      response = igdb_connection.post('/v4/games', body)

      (response.body || []).map { |item| normalize(item) }
    end

    private

    # 日本語文字（ひらがな・カタカナ・漢字）が含まれるか判定
    def japanese?(text)
      text.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
    end

    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')

      # IGDBはプレーンテキストのクエリ言語を使うため、request :json は使わない
      Faraday.new(url: IGDB_URL) do |f|
        f.response :json
        f.headers['Authorization'] = "Bearer #{token}"
        f.headers['Client-ID'] = client_id
        f.adapter Faraday.default_adapter
      end
    end

    def access_token
      Rails.cache.fetch(TOKEN_CACHE_KEY, expires_in: 50.days) do
        params = {
          client_id: ENV.fetch('IGDB_CLIENT_ID'),
          client_secret: ENV.fetch('IGDB_CLIENT_SECRET'),
          grant_type: 'client_credentials'
        }
        response = Faraday.post(TWITCH_TOKEN_URL, params)
        JSON.parse(response.body)['access_token']
      end
    end

    # alternative_namesから日本語タイトルを探す
    def japanese_title(item)
      alt_names = item['alternative_names'] || []
      jp = alt_names.find do |a|
        a['comment']&.match?(/Japanese title/i) &&
          a['name']&.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
      end
      jp&.dig('name')
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
          first_release_date: item['first_release_date']
        }.compact
      )
    end
  end
end
