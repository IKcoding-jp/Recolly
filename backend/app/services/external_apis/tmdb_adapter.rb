# frozen_string_literal: true

module ExternalApis
  # rubocop:disable Metrics/ClassLength -- シーズン展開(Task 2)の組み込みで150行上限を5行超過。
  # 展開ロジック自体はTmdbSeasonExpanderに分離済みで、本クラスへの追加は呼び出し1メソッド分のみ
  class TmdbAdapter < BaseAdapter
    BASE_URL = 'https://api.themoviedb.org'
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
    # TMDBのジャンルID: Animation
    ANIMATION_GENRE_ID = 16
    # Wikipedia経由フォールバック検索を試みる閾値（この件数以下なら追加検索する）
    NAKAGURO_RETRY_THRESHOLD = 3
    # 一次検索のタイムアウト。TMDBが詰まっても他アダプタの結果があるため、早めに諦めて検索全体の応答を優先する
    PRIMARY_OPEN_TIMEOUT = 2
    PRIMARY_TIMEOUT = 5
    # 補完は失敗しても英語説明にフォールバックするだけなので短いタイムアウトで攻める
    ENRICHMENT_OPEN_TIMEOUT = 2
    ENRICHMENT_TIMEOUT = 3
    # 代替タイトル追加検索もベストエフォート（失敗しても一次検索結果を返すだけ）のため短いタイムアウトで攻める。
    # 対象タイトル数を絞るのは、同時リクエストの束がTMDB側の流量制限を踏み後続の一次検索まで詰まる事象があったため
    SUPPLEMENTARY_OPEN_TIMEOUT = 2
    SUPPLEMENTARY_TIMEOUT = 3
    SUPPLEMENTARY_TITLE_LIMIT = 3

    def media_types
      %w[movie drama]
    end

    def search(query, media_type: nil) # rubocop:disable Lint/UnusedMethodArgument -- BaseAdapterインターフェース準拠
      results = search_movies_and_tv_in_parallel(query)

      # 結果が少ない場合、WikipediaClientで正式タイトルを取得してTMDB再検索する
      # 例: 「ウォーキングデッド」→ Wikipedia「ウォーキング・デッド」→ TMDB再検索
      results = search_via_wikipedia(query, results) if results.length <= NAKAGURO_RETRY_THRESHOLD

      expand_seasons(query, results)
    end

    # AniListの結果に対して、TMDBから日本語の説明文を取得する
    # タイトルでTMDBを検索し、最初にマッチしたmovie/tvの日本語overviewを返す
    # ただし TMDB が曖昧マッチで親作品（Season 1 等）を返すケースは TitleMatcher で弾く
    # 見つからない場合やエラー時はnilを返す（呼び出し元で英語説明をフォールバックに使う）
    def fetch_japanese_description(query)
      response = enrichment_connection.get('/3/search/multi',
                                           api_key: ENV.fetch('TMDB_API_KEY'),
                                           query: query,
                                           language: 'ja')

      results = response.body['results'] || []
      best_match_description(results, query)
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbAdapter] 日本語説明取得エラー: #{e.message}")
      nil
    end

    private

    # 映画検索とTV検索を並列に実行する（逐次だと最悪でタイムアウト2回分待つため）
    # スレッドごとに新しいコネクションを使う（Faradayコネクションの共有を避けるため）
    def search_movies_and_tv_in_parallel(query)
      [Thread.new { search_movies(query, conn: primary_connection) },
       Thread.new { search_tv(query, conn: primary_connection) }].flat_map(&:value)
    end

    def primary_connection
      connection(url: BASE_URL, open_timeout: PRIMARY_OPEN_TIMEOUT, timeout: PRIMARY_TIMEOUT)
    end

    # TVシリーズ結果をシーズン単位に展開する（展開ロジックはTmdbSeasonExpander参照）
    # 詳細取得コネクションはスレッドごとに生成する（Faradayコネクション共有回避）
    def expand_seasons(query, results)
      factory = lambda do
        connection(url: BASE_URL, open_timeout: SUPPLEMENTARY_OPEN_TIMEOUT,
                   timeout: SUPPLEMENTARY_TIMEOUT, retry_on_timeout: false)
      end
      TmdbSeasonExpander.new(query, connection_factory: factory).expand(results)
    end

    # Wikipedia検索で正式タイトルを取得し、TMDBで追加検索する
    # 例: 「ウォーキングデッド」→ Wikipedia「ウォーキング・デッド」→ TMDB再検索
    def search_via_wikipedia(query, existing_results)
      wikipedia = ExternalApis::WikipediaClient.new
      titles = wikipedia.search(query, limit: SUPPLEMENTARY_TITLE_LIMIT).reject { |title| title == query }
      return existing_results if titles.empty?

      merge_results(existing_results, fetch_supplementary_results(titles))
    rescue StandardError => e
      Rails.logger.error("[TmdbAdapter] Wikipedia補完エラー: #{e.message}")
      existing_results
    end

    # 代替タイトルを短いタイムアウトで並列問い合わせする
    # movie/tvもタイトル単位でスレッドを分け、逐次待ちをなくす
    # エンドポイントごとに個別にエラーを握りつぶす（片方が失敗してももう片方の結果は活かす）
    def fetch_supplementary_results(titles)
      threads = titles.flat_map do |title|
        [
          Thread.new { supplementary_search(title) { |t, c| search_movies(t, conn: c) } },
          Thread.new { supplementary_search(title) { |t, c| search_tv(t, conn: c) } }
        ]
      end
      threads.flat_map(&:value)
    end

    # スレッドごとに短タイムアウト・リトライなしのコネクションを作って検索する
    def supplementary_search(title)
      conn = connection(url: BASE_URL, open_timeout: SUPPLEMENTARY_OPEN_TIMEOUT,
                        timeout: SUPPLEMENTARY_TIMEOUT, retry_on_timeout: false)
      yield(title, conn)
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbAdapter] 代替タイトル検索エラー: #{e.message}")
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

    # 候補から最も適切な日本語説明を選ぶ
    # 1. movie/tv のみ対象
    # 2. 日本語原語を優先（同名の外国作品との誤マッチを防止）
    # 3. 選択した結果の name/title が query と十分一致しない場合は nil
    #    （TMDB が 'X Season 2' で親作品 'X' を返す誤マッチ防止）
    # 注: title_match? は「絞り込み後の match に対してのみ」呼ぶこと。
    # 先に title_match? でフィルタすると日本語原語優先の挙動が崩れるため。
    def best_match_description(results, query)
      candidates = results.select { |item| %w[movie tv].include?(item['media_type']) }
      match = candidates.find { |item| item['original_language'] == 'ja' } || candidates.first
      return nil unless match

      # tv は name、movie は title を使う
      match_title = match['name'] || match['title']
      return nil unless TitleMatcher.title_match?(query, match_title)

      match['overview'].presence
    end

    # search/movie エンドポイントで映画を検索
    def search_movies(query, conn: primary_connection)
      response = conn.get('/3/search/movie',
                          api_key: ENV.fetch('TMDB_API_KEY'),
                          query: query,
                          language: 'ja')
      (response.body['results'] || [])
        .reject { |item| japanese_animation?(item) }
        .map { |item| normalize_movie(item) }
    end

    # search/tv エンドポイントでTV番組を検索
    def search_tv(query, conn: primary_connection)
      response = conn.get('/3/search/tv',
                          api_key: ENV.fetch('TMDB_API_KEY'),
                          query: query,
                          language: 'ja')
      (response.body['results'] || [])
        .reject { |item| japanese_animation?(item) }
        .map { |item| normalize_tv(item) }
    end

    def japanese_animation?(item)
      genre_ids = item['genre_ids'] || []
      genre_ids.include?(ANIMATION_GENRE_ID) && item['original_language'] == 'ja'
    end

    # 補完は失敗しても英語説明にフォールバックするだけなので短いタイムアウトで攻める
    def enrichment_connection
      @enrichment_connection ||= connection(
        url: BASE_URL, open_timeout: ENRICHMENT_OPEN_TIMEOUT, timeout: ENRICHMENT_TIMEOUT,
        retry_on_timeout: false
      )
    end

    def normalize_movie(item)
      SearchResult.new(
        item['title'],
        'movie',
        item['overview'],
        item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        nil,
        item['id'].to_s,
        'tmdb',
        {
          release_date: item['release_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average'],
          # TMDBのpopularityは0〜数百の範囲。100で割って0〜1に正規化
          popularity: normalize_popularity(item['popularity'])
        }.compact
      )
    end

    def normalize_tv(item)
      SearchResult.new(
        item['name'],
        'drama',
        item['overview'],
        item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        nil,
        item['id'].to_s,
        'tmdb',
        {
          release_date: item['first_air_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average'],
          # TMDBのpopularityは0〜数百の範囲。100で割って0〜1に正規化
          popularity: normalize_popularity(item['popularity'])
        }.compact
      )
    end

    # TMDBのpopularity値を0.0〜1.0に正規化
    def normalize_popularity(value)
      return 0.0 unless value

      [value.to_f / 100.0, 1.0].min
    end
  end
  # rubocop:enable Metrics/ClassLength
end
