# frozen_string_literal: true

module ExternalApis
  class GoogleBooksAdapter < BaseAdapter
    BASE_URL = 'https://www.googleapis.com'

    def media_types
      %w[book]
    end

    def search(query, media_type: nil) # rubocop:disable Lint/UnusedMethodArgument -- BaseAdapterインターフェース準拠
      # intitle: でタイトル検索に限定し、無関係な結果を除外する。
      # langRestrict=ja は Google Books API が特定の日本語クエリで断続的に 503 を返すため付与しない
      # （例: intitle:成瀬は天下を取りにいく。langRestrict=ja なしでは安定して結果が返る）。
      # 代わりに volumeInfo.language で日本語書籍のみをクライアント側で絞り込む。
      params = { q: "intitle:#{query}", key: ENV.fetch('GOOGLE_BOOKS_API_KEY'), maxResults: 40 }
      response = books_connection.get('/books/v1/volumes', params)

      items = response.body['items'] || []
      items.select { |item| japanese_or_unspecified?(item) }
           .map { |item| normalize(item) }
    end

    private

    # language が 'ja' の書籍を返す。language が未設定の場合も許容する
    # （Google Books では古い書籍などで language が欠損するケースがあり、切り落とすのは過剰）。
    def japanese_or_unspecified?(item)
      language = item.dig('volumeInfo', 'language')
      language.nil? || language == 'ja'
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
        normalize_cover_image_url(info.dig('imageLinks', 'thumbnail')),
        nil,
        item['id'],
        'google_books',
        {
          authors: info['authors'],
          publisher: info['publisher'],
          published_date: info['publishedDate'],
          page_count: info['pageCount'],
          categories: info['categories'],
          # ISBNはopenBD補完に使用する。ISBN-13を優先し、なければISBN-10
          isbn: extract_isbn(info),
          # ratingsCountで人気度を推定。100件レビューで正規化上限1.0
          popularity: normalize_popularity(info['ratingsCount'])
        }.compact
      )
    end

    # Google Books は thumbnail URL を http:// で返すことが多いが、
    # 本番は HTTPS 配信のため Mixed Content でブロックされる。
    # プロトコルのみ https:// に置換する（Google Books は同一パスを HTTPS でも配信している）
    def normalize_cover_image_url(url)
      url&.sub(%r{\Ahttp://}, 'https://')
    end

    # industryIdentifiersからISBNを抽出。ISBN-13を最優先、なければISBN-10
    def extract_isbn(info)
      identifiers = info['industryIdentifiers'] || []
      isbn13 = identifiers.find { |i| i['type'] == 'ISBN_13' }
      isbn10 = identifiers.find { |i| i['type'] == 'ISBN_10' }
      isbn13&.dig('identifier') || isbn10&.dig('identifier')
    end

    # Google Booksのレビュー数を0.0〜1.0に正規化
    def normalize_popularity(value)
      return 0.0 unless value

      [value.to_f / 100.0, 1.0].min
    end
  end
end
