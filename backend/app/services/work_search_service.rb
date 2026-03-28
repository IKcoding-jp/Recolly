# frozen_string_literal: true

class WorkSearchService
  CACHE_TTL = 30.minutes

  def search(query, media_type: nil)
    cache_key = "work_search:#{media_type || 'all'}:#{query}"

    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
      adapters = select_adapters(media_type)
      results = adapters.flat_map { |adapter| adapter.safe_search(query) }
      results = results.select { |r| r.media_type == media_type } if media_type.present?
      enrich_anilist_descriptions(results)
      remove_english_descriptions(results)
      sort_by_popularity(results)
    end
  end

  private

  # クラス定数ではなくメソッドで返す（Zeitwerkのオートロード順序問題を回避）
  # movieにAniListを含める（アニメ映画はTMDBで除外されるためAniList経由で取得）
  def adapter_map
    {
      'movie' => [ExternalApis::TmdbAdapter, ExternalApis::AniListAdapter],
      'drama' => [ExternalApis::TmdbAdapter],
      'anime' => [ExternalApis::AniListAdapter],
      'manga' => [ExternalApis::AniListAdapter],
      'book' => [ExternalApis::GoogleBooksAdapter],
      'game' => [ExternalApis::IgdbAdapter]
    }
  end

  def select_adapters(media_type)
    if media_type.present?
      classes = adapter_map[media_type]
      classes ? classes.map(&:new) : []
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
      description = fetch_japanese_description_from_tmdb(result, tmdb)
      description ||= wikipedia.fetch_extract(result.title)
      result.description = resolve_description(description, result.description)
    end
  end

  # TMDBで日本語説明を検索（日本語タイトル優先で複数パターンを順番に試す）
  # 日本語タイトルの方がTMDB（language: 'ja'）でのマッチ精度が高い
  def fetch_japanese_description_from_tmdb(result, tmdb)
    queries = [
      result.title,
      result.metadata[:title_english],
      result.metadata[:title_romaji]
    ].compact.uniq

    queries.each do |query|
      description = tmdb.fetch_japanese_description(query)
      return description if description.present?
    end
    nil
  end

  # 全結果から英語の説明文を除去する（IGDB等の英語説明も対象）
  def remove_english_descriptions(results)
    results.each { |r| r.description = nil if english_text?(r.description) }
  end

  # 日本語説明が見つかればそれを使い、見つからなければ英語説明を除去する
  def resolve_description(japanese_desc, original_desc)
    return japanese_desc if japanese_desc.present?

    english_text?(original_desc) ? nil : original_desc
  end

  # 文字列の半分以上がASCII文字なら英語と判定
  def english_text?(text)
    return false if text.blank?

    ascii_ratio = text.count("\x20-\x7E").to_f / text.length
    ascii_ratio > 0.5
  end

  # 各アダプターが返すmetadata[:popularity]（0.0〜1.0に正規化済み）で降順ソート
  def sort_by_popularity(results)
    results.sort_by { |r| -(r.metadata[:popularity] || 0) }
  end
end
