# frozen_string_literal: true

class WorkSearchService
  CACHE_TTL = 30.minutes

  def search(query, media_type: nil)
    cache_key = "work_search:#{media_type || 'all'}:#{query}"

    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
      adapters = select_adapters(media_type)
      results = adapters.flat_map { |adapter| adapter.safe_search(query) }
      enrich_anilist_descriptions(results)
      sort_by_popularity(results)
    end
  end

  private

  # クラス定数ではなくメソッドで返す（Zeitwerkのオートロード順序問題を回避）
  def adapter_map
    {
      'movie' => ExternalApis::TmdbAdapter,
      'drama' => ExternalApis::TmdbAdapter,
      'anime' => ExternalApis::AniListAdapter,
      'manga' => ExternalApis::AniListAdapter,
      'book' => ExternalApis::GoogleBooksAdapter,
      'game' => ExternalApis::IgdbAdapter
    }
  end

  def select_adapters(media_type)
    if media_type.present?
      adapter_class = adapter_map[media_type]
      adapter_class ? [adapter_class.new] : []
    else
      all_adapters
    end
  end

  def all_adapters
    [
      ExternalApis::TmdbAdapter.new,
      ExternalApis::AniListAdapter.new,
      ExternalApis::GoogleBooksAdapter.new,
      ExternalApis::IgdbAdapter.new
    ]
  end

  # AniListの結果にTMDB→Wikipediaの順で日本語説明を補完する
  # AniListの説明は英語のため、日本語の説明が見つかれば置き換える
  def enrich_anilist_descriptions(results)
    anilist_results = results.select { |r| r.external_api_source == 'anilist' }
    return if anilist_results.empty?

    tmdb = ExternalApis::TmdbAdapter.new
    wikipedia = ExternalApis::WikipediaClient.new

    anilist_results.each do |result|
      # ① TMDB検索（英語→ローマ字→日本語の順で複数パターンを試す）
      description = fetch_japanese_description_from_tmdb(result, tmdb)
      # ② TMDBで見つからなければWikipediaから取得
      description ||= wikipedia.fetch_extract(result.title)
      result.description = description if description.present?
    end
  end

  # TMDBで日本語説明を検索（複数パターンを順番に試す）
  def fetch_japanese_description_from_tmdb(result, tmdb)
    queries = [
      result.metadata[:title_english],
      result.metadata[:title_romaji],
      result.title
    ].compact.uniq

    queries.each do |query|
      description = tmdb.fetch_japanese_description(query)
      return description if description.present?
    end
    nil
  end

  # 各アダプターが返すmetadata[:popularity]（0.0〜1.0に正規化済み）で降順ソート
  def sort_by_popularity(results)
    results.sort_by { |r| -(r.metadata[:popularity] || 0) }
  end
end
