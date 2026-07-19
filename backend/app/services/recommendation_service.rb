# おすすめ機能の全体調整役
# 一括分析の結果を総合（Recommendation）とメディア別（MediaPreferenceProfile）に分配保存する
class RecommendationService
  def initialize(user)
    @user = user
  end

  def fetch
    @user.recommendation
  end

  def generate
    analysis = PreferenceAnalyzer.new(@user).analyze
    return nil if analysis.nil?

    save_result(analysis, build_media_results(analysis))
  end

  private

  def build_media_results(analysis)
    recommender = WorkRecommender.new(@user)
    media_recommendations = analysis[:media_recommendations] || {}
    Work.media_types.keys.index_with do |media_type|
      media_rec = media_recommendations[media_type]
      # 分析結果に無いメディアは検索APIを呼ばず空のまま返す（不要な外部API呼び出しを避ける）
      next { trend: '', works: [] } if media_rec.blank?

      { trend: media_rec['trend'].to_s, works: recommender.recommend(media_type, media_rec['works'] || []) }
    end
  end

  # 総合とメディア別の表示が食い違わないよう、同一トランザクションで保存する
  def save_result(analysis, media_results)
    counts = media_record_counts
    analyzed_at = Time.current
    recommendation = Recommendation.find_or_initialize_by(user: @user)

    ActiveRecord::Base.transaction do
      recommendation.update!(recommendation_attributes(analysis, analyzed_at))
      media_results.each do |media_type, result|
        save_media_profile(media_type, result, counts, analyzed_at)
      end
    end
    recommendation
  end

  def recommendation_attributes(analysis, analyzed_at)
    {
      analysis_summary: analysis[:summary],
      preference_scores: analysis[:preference_scores],
      genre_stats: stringify_keys_in_array(analysis[:genre_stats]),
      top_tags: stringify_keys_in_array(analysis[:top_tags]),
      record_count: @user.records.count,
      analyzed_at: analyzed_at
    }
  end

  def save_media_profile(media_type, result, counts, analyzed_at)
    profile = MediaPreferenceProfile.find_or_initialize_by(user: @user, media_type: media_type)
    profile.update!(
      analysis_summary: result[:trend],
      same_media_works: stringify_keys_in_array(result[:works]),
      record_count: counts[media_type] || 0,
      analyzed_at: analyzed_at
    )
  end

  # ActiveRecordがenumカラムのgroup結果を自動でenum名（文字列）にキャストするため、
  # 逆引き変換は不要（カラム名の型キャストのみで media_type 文字列キーが得られる）
  def media_record_counts
    @user.records.joins(:work).group('works.media_type').count
  end

  def stringify_keys_in_array(array)
    (array || []).map { |item| item.transform_keys(&:to_s) }
  end
end
