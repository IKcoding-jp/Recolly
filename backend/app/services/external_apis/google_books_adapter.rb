# frozen_string_literal: true

module ExternalApis
  class GoogleBooksAdapter < BaseAdapter
    BASE_URL = 'https://www.googleapis.com'

    def media_types
      %w[book]
    end

    def search(query)
      params = { q: query, key: ENV.fetch('GOOGLE_BOOKS_API_KEY'), maxResults: 20, langRestrict: 'ja' }
      response = books_connection.get('/books/v1/volumes', params)

      items = response.body['items'] || []
      results = items.map { |item| normalize(item) }
      filter_by_title(results, query)
    end

    private

    # 検索キーワードがタイトルに含まれる結果のみ残す（大文字小文字区別なし）
    def filter_by_title(results, query)
      query_downcase = query.downcase
      results.select { |r| r.title&.downcase&.include?(query_downcase) }
    end

    def books_connection
      @books_connection ||= connection(url: BASE_URL)
    end

    def normalize(item)
      info = item['volumeInfo'] || {}

      SearchResult.new(
        info['title'],
        'book',
        info['description'],
        info.dig('imageLinks', 'thumbnail'),
        nil,
        item['id'],
        'google_books',
        {
          authors: info['authors'],
          publisher: info['publisher'],
          published_date: info['publishedDate'],
          page_count: info['pageCount'],
          categories: info['categories'],
          # ratingsCountで人気度を推定。100件レビューで正規化上限1.0
          popularity: normalize_popularity(info['ratingsCount'])
        }.compact
      )
    end

    # Google Booksのレビュー数を0.0〜1.0に正規化
    def normalize_popularity(value)
      return 0.0 unless value

      [value.to_f / 100.0, 1.0].min
    end
  end
end
