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
        Work.media_types.keys.map { |media_type| profile_entry(media_type, profiles[media_type], counts) }
      end

      def pending_profiles(status, counts)
        Work.media_types.keys.map do |media_type|
          { media_type:, status:, record_count: counts[media_type] || 0 }
        end
      end

      def profile_entry(media_type, profile, counts)
        if profile.nil?
          # 未生成のまま放置されないよう、閲覧をトリガーに分析を自動起動する
          RecommendationRefreshJob.enqueue_once(current_user.id)
          return { media_type:, status: 'generating', record_count: counts[media_type] || 0 }
        end

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
