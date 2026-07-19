# おすすめ分析の非同期更新ジョブ（総合＋メディア別を一括で生成する）
class RecommendationRefreshJob < ApplicationJob
  queue_as :default

  # 多重起動防止フラグの有効期限。分析1回の所要時間より十分長くする
  ENQUEUE_FLAG_TTL = 10.minutes

  # フラグが立っている間は再エンキューしない（コントローラーからはこちらを使う）
  def self.enqueue_once(user_id)
    key = enqueue_flag_key(user_id)
    return if Rails.cache.exist?(key)

    Rails.cache.write(key, true, expires_in: ENQUEUE_FLAG_TTL)
    perform_later(user_id)
  end

  def self.enqueue_flag_key(user_id)
    "recommendation_refresh_enqueued:#{user_id}"
  end

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    RecommendationService.new(user).generate
    Rails.logger.info("[RecommendationRefreshJob] ユーザー#{user_id}の分析を完了")
  rescue StandardError => e
    Rails.logger.error("[RecommendationRefreshJob] ユーザー#{user_id}の分析に失敗: #{e.message}")
    raise
  ensure
    # 失敗時もフラグを消し、次のアクセスで再試行できるようにする
    Rails.cache.delete(self.class.enqueue_flag_key(user_id))
  end
end
