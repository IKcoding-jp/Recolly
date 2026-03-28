# frozen_string_literal: true

module ExternalApis
  # WikipediaClientを使い、ゲーム記事のみをフィルタリングして返す補完アダプター
  # BaseAdapterを継承しない（単独で検索結果を返さず、IgdbAdapterの補完として使う）
  class WikipediaGameAdapter
    # タイトルベースの除外パターン（カテゴリチェック前の事前フィルタ）
    NON_GAME_PATTERNS = /キャラクター|シリーズ|曖昧さ回避|登場人物|一覧|映画|テレビアニメ|劇場版|小説|ドラマ/
    # ゲーム関連カテゴリの判定パターン
    GAME_CATEGORY_PATTERNS = /コンピュータゲーム|ゲームソフト|ビデオゲーム|ゲーム作品|アーケードゲーム|モバイルゲーム/

    def initialize
      @client = WikipediaClient.new
    end

    # 日本語Wikipediaでキーワード検索し、ゲームソフトの記事タイトルのみ返す
    # ① タイトルパターンで事前フィルタ → ② カテゴリチェックでゲーム記事のみ通す
    def search_titles(query)
      titles = @client.search(query)
      filtered = titles.reject { |title| excluded_title?(title, query) }
      filter_by_game_categories(filtered)
    end

    delegate :fetch_english_title, :fetch_extract, to: :@client

    private

    def excluded_title?(title, query)
      return true if title.match?(NON_GAME_PATTERNS)
      return true if title == query

      false
    end

    # Wikipediaカテゴリでゲーム記事かどうかを判定し、ゲーム記事のみ返す
    def filter_by_game_categories(titles)
      return [] if titles.empty?

      categories_map = @client.fetch_categories(titles)
      titles.select { |title| game_article?(categories_map[title]) }
    end

    def game_article?(categories)
      return false if categories.blank?

      categories.any? { |cat| cat.match?(GAME_CATEGORY_PATTERNS) }
    end
  end
end
