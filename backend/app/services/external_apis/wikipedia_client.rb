# frozen_string_literal: true

module ExternalApis
  # 日本語Wikipedia APIの汎用クライアント
  # 検索、記事概要取得、言語間リンク取得、カテゴリ取得を提供する
  # WikipediaGameAdapterやWorkSearchServiceから利用される
  class WikipediaClient
    ENDPOINT = 'https://ja.wikipedia.org/w/api.php'
    USER_AGENT = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'

    # キーワード検索でタイトル一覧を返す
    def search(query, limit: 10)
      response = connection.get('', search_params(query, limit))
      results = response.body.dig('query', 'search') || []
      results.pluck('title')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 検索エラー: #{e.message}")
      []
    end

    # 記事の冒頭テキスト（概要）を取得する
    def fetch_extract(title)
      response = connection.get('', extract_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      return nil if page.nil? || page.key?('missing')

      page['extract'].presence
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 概要取得エラー: #{e.message}")
      nil
    end

    # 日本語Wikipediaの言語間リンクから英語タイトルを取得する
    def fetch_english_title(title)
      response = connection.get('', langlink_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      langlinks = page&.dig('langlinks') || []
      langlinks.first&.dig('*')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 英語タイトル取得エラー: #{e.message}")
      nil
    end

    # 複数タイトルのカテゴリを一括取得する
    # 戻り値: { "タイトル" => ["Category:カテゴリ名", ...], ... }
    def fetch_categories(titles)
      joined = Array(titles).join('|')
      response = connection.get('', categories_params(joined))
      pages = response.body.dig('query', 'pages') || {}
      parse_categories(pages)
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] カテゴリ取得エラー: #{e.message}")
      {}
    end

    private

    def parse_categories(pages)
      pages.each_with_object({}) do |(_, page), result|
        next if page.key?('missing')

        title = page['title']
        result[title] = (page['categories'] || []).map { |c| c['title'] }
      end
    end

    def connection
      @connection ||= Faraday.new(
        url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = USER_AGENT
        f.adapter Faraday.default_adapter
      end
    end

    def search_params(query, limit)
      { action: 'query', list: 'search', srsearch: query, srlimit: limit, format: 'json' }
    end

    def extract_params(title)
      { action: 'query', titles: title, prop: 'extracts', exintro: true,
        explaintext: true, format: 'json' }
    end

    def langlink_params(title)
      { action: 'query', titles: title, prop: 'langlinks', lllang: 'en', format: 'json' }
    end

    def categories_params(titles)
      { action: 'query', titles: titles, prop: 'categories', cllimit: 500, format: 'json' }
    end
  end
end
