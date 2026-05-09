module Api
  module V1
    class MediaPreferenceProfilesController < ApplicationController
      before_action :authenticate_user!

      def index
        profiles = Work.media_types.keys.map { |media_type| build_profile_data(media_type) }
        render json: profiles
      end

      private

      def build_profile_data(media_type)
        record_count = current_user.records.joins(:work)
                                   .where(works: { media_type: Work.media_types[media_type] })
                                   .count

        return { media_type:, status: 'no_records', record_count: } if record_count.zero?

        if record_count < MediaPreferenceAnalyzer::MINIMUM_RECORDS
          return {
            media_type:,
            status: 'insufficient_records',
            record_count:,
            required_count: MediaPreferenceAnalyzer::MINIMUM_RECORDS
          }
        end

        profile = current_user.media_preference_profiles
                              .find_by(media_type: Work.media_types[media_type])

        return { media_type:, status: 'generating', record_count: } if profile.nil?

        format_profile(profile, media_type)
      end

      def format_profile(profile, media_type)
        {
          media_type:,
          status: 'ready',
          analysis_summary: profile.analysis_summary,
          preference_scores: profile.preference_scores,
          top_tags: profile.top_tags,
          same_media_works: profile.same_media_works,
          cross_media_works: profile.cross_media_works,
          record_count: profile.record_count,
          analyzed_at: profile.analyzed_at&.iso8601
        }
      end
    end
  end
end
