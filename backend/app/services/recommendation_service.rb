# おすすめ機能の全体調整役
# PreferenceAnalyzer（好み分析）とWorkRecommender（作品検索）を組み合わせる
class RecommendationService
  REFRESH_THRESHOLD = 5

  def initialize(user)
    @user = user
  end

  def fetch
    @user.recommendation
  end

  def generate
    analysis = PreferenceAnalyzer.new(@user).analyze
    return nil if analysis.nil?

    recommendations = WorkRecommender.new(@user, analysis).recommend
    save_result(analysis, recommendations)
  end

  def needs_refresh?
    recommendation = @user.recommendation
    return true if recommendation.nil?

    current_count = @user.records.count
    current_count - recommendation.record_count >= REFRESH_THRESHOLD
  end

  private

  def save_result(analysis, recommendations)
    recommendation = @user.recommendation || @user.build_recommendation

    recommendation.update!(
      analysis_summary: analysis[:summary],
      preference_scores: analysis[:preference_scores],
      genre_stats: stringify_keys_in_array(analysis[:genre_stats]),
      top_tags: stringify_keys_in_array(analysis[:top_tags]),
      recommended_works: stringify_keys_in_array(recommendations[:recommended_works]),
      challenge_works: stringify_keys_in_array(recommendations[:challenge_works]),
      record_count: @user.records.count,
      analyzed_at: Time.current
    )

    recommendation
  end

  def stringify_keys_in_array(array)
    array.map { |item| item.transform_keys(&:to_s) }
  end
end
