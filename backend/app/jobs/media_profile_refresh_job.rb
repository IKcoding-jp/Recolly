# メディア別好みプロファイルを非同期で更新するジョブ
# media_typeなしで呼ぶとオーケストレーターとして各メディアのジョブを並列起動する
class MediaProfileRefreshJob < ApplicationJob
  queue_as :default

  def perform(user_id, media_type = nil)
    user = User.find_by(id: user_id)
    return if user.nil?

    if media_type.nil?
      eligible_media_types(user).each { |mt| self.class.perform_later(user_id, mt) }
    else
      MediaPreferenceAnalyzer.new(user, media_type).analyze_and_save
      Rails.logger.info("[MediaProfileRefreshJob] #{media_type}の分析完了（ユーザー#{user_id}）")
    end
  rescue StandardError => e
    Rails.logger.error("[MediaProfileRefreshJob] 失敗（ユーザー#{user_id}, #{media_type}）: #{e.message}")
    raise
  end

  private

  def eligible_media_types(user)
    Work.media_types.keys.select do |mt|
      count = user.records
                  .joins(:work)
                  .where(works: { media_type: Work.media_types[mt] })
                  .count
      count >= MediaPreferenceAnalyzer::MINIMUM_RECORDS
    end
  end
end
