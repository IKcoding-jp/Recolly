# frozen_string_literal: true

module ExternalApis
  # 日本語Wikipediaからゲームタイトルと説明文を取得する補完アダプター
  # BaseAdapterを継承しない（単独で検索結果を返さず、IgdbAdapterの補完として使う）
  class WikipediaGameAdapter
    ENDPOINT = 'https://ja.wikipedia.org/w/api.php'

    # 日本語Wikipediaでキーワード検索し、記事タイトルの一覧を返す
    def search_titles(query)
      response = wikipedia_connection.get('', search_params(query))
      results = response.body.dig('query', 'search') || []
      results.pluck('title')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaGameAdapter] 検索エラー: #{e.message}")
      []
    end

    # 日本語Wikipediaの言語間リンクから英語タイトルを取得する
    # IGDBは英語タイトルで検索する必要があるため、この変換が必要
    def fetch_english_title(ja_title)
      response = wikipedia_connection.get('', langlink_params(ja_title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      langlinks = page&.dig('langlinks') || []
      langlinks.first&.dig('*')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaGameAdapter] 英語タイトル取得エラー: #{e.message}")
      nil
    end

    # 指定タイトルのWikipedia記事から冒頭テキスト（概要）を取得する
    def fetch_extract(title)
      response = wikipedia_connection.get('', extract_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      return nil if page.nil? || page.key?('missing')

      page['extract'].presence
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaGameAdapter] 概要取得エラー: #{e.message}")
      nil
    end

    private

    def wikipedia_connection
      @wikipedia_connection ||= Faraday.new(
        url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'
        f.adapter Faraday.default_adapter
      end
    end

    def search_params(query)
      { action: 'query', list: 'search', srsearch: query, srlimit: 10, format: 'json' }
    end

    def extract_params(title)
      { action: 'query', titles: title, prop: 'extracts', exintro: true,
        explaintext: true, format: 'json' }
    end

    def langlink_params(title)
      { action: 'query', titles: title, prop: 'langlinks', lllang: 'en', format: 'json' }
    end
  end
end
