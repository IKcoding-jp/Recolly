# frozen_string_literal: true

module ExternalApis
  # 検索結果が少ないとき、Wikipediaで正式タイトルを取得してTMDBを追加検索する補完検索
  # 例: 「ウォーキングデッド」→ Wikipedia「ウォーキング・デッド」→ TMDB再検索
  # TmdbAdapter本体とは責務が独立しているため別クラスに分離している（1ファイル200行規約）
  class TmdbWikipediaFallback
    SUPPLEMENTARY_TITLE_LIMIT = 3

    # movie_search / tv_search: (title, conn) を受け取ってTMDB検索するcallable
    # connection_factory: 呼ぶたびに新しい短タイムアウトコネクションを返すlambda
    # （Faradayコネクションのスレッド間共有を避けるため。TmdbAdapterと同方針）
    def initialize(movie_search:, tv_search:, connection_factory:)
      @movie_search = movie_search
      @tv_search = tv_search
      @connection_factory = connection_factory
    end

    # Wikipedia検索で正式タイトルを取得し、TMDBで追加検索する
    # 例: 「ウォーキングデッド」→ Wikipedia「ウォーキング・デッド」→ TMDB再検索
    def search(query, existing_results)
      wikipedia = ExternalApis::WikipediaClient.new
      titles = wikipedia.search(query, limit: SUPPLEMENTARY_TITLE_LIMIT).reject { |title| title == query }
      return existing_results if titles.empty?

      merge_results(existing_results, fetch_supplementary_results(titles))
    rescue StandardError => e
      Rails.logger.error("[TmdbWikipediaFallback] Wikipedia補完エラー: #{e.message}")
      existing_results
    end

    private

    # 代替タイトルを短いタイムアウトで並列問い合わせする
    # movie/tvもタイトル単位でスレッドを分け、逐次待ちをなくす
    # エンドポイントごとに個別にエラーを握りつぶす（片方が失敗してももう片方の結果は活かす）
    def fetch_supplementary_results(titles)
      threads = titles.flat_map do |title|
        [
          Thread.new { supplementary_search(title) { |t, c| @movie_search.call(t, c) } },
          Thread.new { supplementary_search(title) { |t, c| @tv_search.call(t, c) } }
        ]
      end
      threads.flat_map(&:value)
    end

    # スレッドごとに短タイムアウト・リトライなしのコネクションを作って検索する
    def supplementary_search(title)
      conn = @connection_factory.call
      yield(title, conn)
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbWikipediaFallback] 代替タイトル検索エラー: #{e.message}")
      []
    end

    # TMDB IDで重複除去しながら結果をマージする
    def merge_results(primary, additional)
      seen_ids = primary.to_set(&:external_api_id)
      combined = primary.dup
      additional.each do |r|
        next if seen_ids.include?(r.external_api_id)

        seen_ids.add(r.external_api_id)
        combined << r
      end
      combined
    end
  end
end
