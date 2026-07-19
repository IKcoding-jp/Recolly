# 好み分析の提案キーワードを外部API検索で実在確認し、採用作品リストを作る
class WorkRecommender
  MAX_ADOPTED = 5
  # 本編ではない派生作品（特別篇・OVA等）はおすすめに採用しない
  EXCLUDED_ANILIST_FORMATS = %w[SPECIAL OVA MUSIC TV_SHORT].freeze

  def initialize(user)
    @user = user
    @search_service = WorkSearchService.new
    @recorded_external_ids = fetch_recorded_external_ids
  end

  # keywords: [{ 'query' => 作品タイトル, 'reason' => 理由 }, ...]
  # 提案順に実在確認し、採用数がmax_countに達したら打ち切る
  def recommend(media_type, keywords, max_count: MAX_ADOPTED)
    results = []
    keywords.each do |keyword|
      break if results.length >= max_count

      work = best_candidate(keyword['query'], media_type, results)
      next if work.nil?

      results << build_work_data(work, keyword['reason'] || '')
    end
    results
  end

  private

  # 検索最上位（本編想定）が既記録なら派生作品へ繰り下げず、その提案自体を見送る
  # （繰り下げると本編を記録済みのユーザーほどOVA・特別篇がおすすめされてしまうため）
  def best_candidate(query, media_type, existing_results)
    return nil if query.blank?

    candidates = @search_service.search(query, media_type: media_type)
                                .reject { |work| excluded_format?(work) }
    best = candidates.first
    return nil if best.nil? || already_recorded?(best)
    return nil if existing_results.any? { |r| r[:title] == best.title }

    best
  end

  def excluded_format?(work)
    work.external_api_source == 'anilist' &&
      EXCLUDED_ANILIST_FORMATS.include?(work.metadata[:format])
  end

  def build_work_data(work, reason)
    {
      title: work.title,
      media_type: work.media_type,
      description: work.description,
      cover_url: work.cover_image_url,
      reason: reason,
      external_api_id: work.external_api_id,
      external_api_source: work.external_api_source,
      metadata: work.metadata || {}
    }
  end

  def already_recorded?(work)
    return false if work.external_api_id.blank?

    key = "#{work.external_api_source}:#{work.external_api_id}"
    @recorded_external_ids.include?(key)
  end

  def fetch_recorded_external_ids
    @user.records.joins(:work)
         .where.not(works: { external_api_id: nil })
         .pluck('works.external_api_source', 'works.external_api_id')
         .to_set { |source, id| "#{source}:#{id}" }
  end
end
