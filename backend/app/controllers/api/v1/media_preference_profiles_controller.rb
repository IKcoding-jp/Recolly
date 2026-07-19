module Api
  module V1
    class MediaPreferenceProfilesController < ApplicationController
      before_action :authenticate_user!

      def index
        render json: build_profiles
      end

      private

      # ステータスは全体の記録数で決まる（メディア別の件数条件は撤廃。ジャンル横断のため）
      def build_profiles
        counts = media_record_counts
        total = current_user.records.count

        return pending_profiles('no_records', counts) if total.zero?
        return pending_profiles('insufficient_records', counts) if total < PreferenceAnalyzer::MINIMUM_RECORDS

        profiles = current_user.media_preference_profiles.index_by(&:media_type)
        enqueue_refresh_if_incomplete(profiles)
        Work.media_types.keys.map { |media_type| profile_entry(media_type, profiles[media_type], counts) }
      end

      # ループ内でRecommendationRefreshJob.enqueue_onceを呼ぶと、キャッシュによる
      # 重複排除が効かない環境（LocalCacheミドルウェアの外や:null_store等）で
      # 1リクエスト中に最大6回多重エンキューされてしまう。プロファイルが1つでも
      # 未生成なら、レスポンス組み立てとは切り離して1リクエストにつき1回だけ呼ぶ
      def enqueue_refresh_if_incomplete(profiles)
        return unless Work.media_types.keys.any? { |media_type| profiles[media_type].nil? }

        RecommendationRefreshJob.enqueue_once(current_user.id)
      end

      def pending_profiles(status, counts)
        Work.media_types.keys.map do |media_type|
          { media_type:, status:, record_count: counts[media_type] || 0 }
        end
      end

      def profile_entry(media_type, profile, counts)
        return { media_type:, status: 'generating', record_count: counts[media_type] || 0 } if profile.nil?

        {
          media_type:,
          status: 'ready',
          analysis_summary: profile.analysis_summary,
          same_media_works: profile.same_media_works,
          record_count: counts[media_type] || 0,
          analyzed_at: profile.analyzed_at&.iso8601
        }
      end

      # group(:media_type)のキーはRailsがenum文字列（'anime'等）にキャスト済みのため変換不要
      def media_record_counts
        current_user.records.joins(:work).group('works.media_type').count
      end
    end
  end
end
