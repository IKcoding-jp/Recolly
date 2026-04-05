# 好み分析結果をもとに外部APIで作品を検索し、おすすめリストを生成する
class WorkRecommender
  MAX_RECOMMENDED = 7
  MAX_CHALLENGE = 3

  def initialize(user, analysis_result)
    @user = user
    @analysis_result = analysis_result
    @search_service = WorkSearchService.new
    @recorded_external_ids = fetch_recorded_external_ids
  end

  def recommend
    recommended = search_works(@analysis_result[:search_keywords]['recommended'], MAX_RECOMMENDED)
    challenge = search_works(@analysis_result[:search_keywords]['challenge'], MAX_CHALLENGE)

    { recommended_works: recommended, challenge_works: challenge }
  end

  private

  def search_works(keywords, max_count)
    results = []
    keywords.each do |keyword|
      break if results.length >= max_count

      add_matching_works(results, keyword, max_count)
    end
    results
  end

  def add_matching_works(results, keyword, max_count)
    found = @search_service.search(keyword['query'], media_type: keyword['media_type'])
    reason = @analysis_result[:reasons][keyword['query']] || ''

    found.each do |work|
      break if results.length >= max_count
      next if already_recorded?(work) || results.any? { |r| r[:title] == work.title }

      results << build_work_data(work, reason)
    end
  end

  def build_work_data(work, reason)
    {
      title: work.title,
      media_type: work.media_type,
      description: work.description,
      cover_url: work.cover_url,
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
