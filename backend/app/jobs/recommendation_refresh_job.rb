# おすすめ分析の非同期更新ジョブ
# 手動更新ボタン押下時、または記録が一定数増えた時に実行される
class RecommendationRefreshJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    RecommendationService.new(user).generate
    Rails.logger.info("[RecommendationRefreshJob] ユーザー#{user_id}の分析を完了")
  rescue StandardError => e
    Rails.logger.error("[RecommendationRefreshJob] ユーザー#{user_id}の分析に失敗: #{e.message}")
    raise
  end
end
