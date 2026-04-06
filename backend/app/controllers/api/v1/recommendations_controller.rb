module Api
  module V1
    class RecommendationsController < ApplicationController
      before_action :authenticate_user!

      def show
        records_count = current_user.records.count

        return render json: { recommendation: nil, status: 'no_records' } if records_count.zero?

        if records_count < PreferenceAnalyzer::MINIMUM_RECORDS
          return render json: insufficient_records_response(records_count)
        end

        render_recommendation
      end

      def refresh
        RecommendationRefreshJob.perform_later(current_user.id)
        render json: { message: '分析を開始しました', status: 'processing' }, status: :accepted
      end

      private

      def render_recommendation
        recommendation = RecommendationService.new(current_user).fetch

        if recommendation.nil?
          RecommendationRefreshJob.perform_later(current_user.id)
          return render json: { recommendation: nil, status: 'generating' }
        end

        render json: { recommendation: format_recommendation(recommendation), status: 'ready' }
      end

      def insufficient_records_response(records_count)
        {
          recommendation: {
            analysis: nil,
            recommended_works: [],
            challenge_works: [],
            genre_stats: genre_stats_for_user,
            record_count: records_count,
            required_count: PreferenceAnalyzer::MINIMUM_RECORDS
          },
          status: 'insufficient_records'
        }
      end

      def format_recommendation(rec)
        {
          analysis: {
            summary: rec.analysis_summary,
            preference_scores: rec.preference_scores,
            genre_stats: rec.genre_stats,
            top_tags: rec.top_tags
          },
          recommended_works: rec.recommended_works,
          challenge_works: rec.challenge_works,
          analyzed_at: rec.analyzed_at&.iso8601,
          record_count: rec.record_count
        }
      end

      def genre_stats_for_user
        Work.joins(:records)
            .where(records: { user_id: current_user.id })
            .group('works.media_type')
            .select('works.media_type', 'COUNT(*) as count', 'AVG(records.rating) as avg_rating')
            .map do |stat|
              { media_type: stat.media_type, count: stat.count, avg_rating: stat.avg_rating&.round(1)&.to_f }
            end
      end
    end
  end
end
