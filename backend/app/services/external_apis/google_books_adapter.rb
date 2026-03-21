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
      items.map { |item| normalize(item) }
    end

    private

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
          categories: info['categories']
        }.compact
      )
    end
  end
end
