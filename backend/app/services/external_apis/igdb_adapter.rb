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
      # ① IGDB直接検索（全文検索 + パターンマッチ）
      keyword_results = search_by_keyword(sanitized)
      pattern_results = search_by_pattern(sanitized)
      igdb_results = merge_results(keyword_results, pattern_results)

      # ② Wikipedia JP で日本語タイトル候補を取得し、IGDBで再検索
      wikipedia_results = search_via_wikipedia(sanitized, igdb_results)

      # ③ マージ
      merge_results(igdb_results, wikipedia_results)
    end

    # searchキーワードによる全文検索（関連度順で返る）
    def search_by_keyword(sanitized)
      body = "search \"#{sanitized}\"; fields #{SEARCH_FIELDS}; limit 20;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    # name / alternative_names.name の部分一致検索
    def search_by_pattern(sanitized)
      where_clause = "name ~ *\"#{sanitized}\"* | alternative_names.name ~ *\"#{sanitized}\"*"
      body = "fields #{SEARCH_FIELDS}; where #{where_clause}; limit 20;"
      response = igdb_connection.post('/v4/games', body)
      (response.body || []).map { |item| normalize(item) }
    end

    # 2つの検索結果をマージし、IDで重複を除去
    def merge_results(primary, secondary)
      seen_ids = primary.to_set(&:external_api_id)
      combined = primary.dup
      secondary.each { |r| combined << r unless seen_ids.include?(r.external_api_id) }
      combined
    end

    # Wikipedia JP で日本語タイトルを取得し、各タイトルでIGDBを再検索
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

    # Wikipediaタイトル1件をIGDBで検索し、日本語情報を付与して返す
    def find_game_via_wikipedia(jp_title, wikipedia, existing_ids)
      match = igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
      return nil if match.nil?

      match.title = jp_title
      match.description = wikipedia.fetch_extract(jp_title).presence || match.description
      existing_ids.add(match.external_api_id)
      match
    end

    # Wikipedia言語間リンクで英語タイトル取得 → IGDBで検索
    # 既存IDと重複しない最初のマッチを返す（リメイク版とオリジナル版を区別）
    def igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids = Set.new)
      en_title = wikipedia.fetch_english_title(jp_title)
      return nil unless en_title

      # Wikipediaの曖昧さ回避テキストを除去: "Resident Evil 2 (2019 video game)" → "Resident Evil 2"
      clean_title = en_title.sub(/\s*\(.*\)\s*$/, '')
      sanitized = clean_title.gsub('"', '\\"').gsub(';', '')
      # 既存IDと重複しない最初のマッチを返す
      search_by_keyword(sanitized).find { |r| existing_ids.exclude?(r.external_api_id) }
    end

    # 日本語文字（ひらがな・カタカナ・漢字）が含まれるか判定
    def japanese?(text)
      text.match?(/[\p{Hiragana}\p{Katakana}\p{Han}]/)
    end

    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')

      # IGDBはプレーンテキストのクエリ言語を使うため、request :json は使わない
      Faraday.new(url: IGDB_URL, request: { open_timeout: 5, timeout: 10 }) do |f|
        # POSTも含める（IGDB検索クエリは冪等のため安全）
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
        # Hashボディをapplication/x-www-form-urlencoded形式に変換する
        token_connection = Faraday.new do |f|
          f.request :url_encoded
          f.response :json
        end
        response = token_connection.post(
          TWITCH_TOKEN_URL,
          {
            client_id: ENV.fetch('IGDB_CLIENT_ID'),
            client_secret: ENV.fetch('IGDB_CLIENT_SECRET'),
            grant_type: 'client_credentials'
          }
        )
        token = response.body['access_token']
        raise "Twitch OAuthトークン取得失敗: #{response.body}" unless token

        token
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

    # IGDBのtotal_rating値を0.0〜1.0に正規化（元は0〜100）
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
