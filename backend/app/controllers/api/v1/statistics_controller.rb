# frozen_string_literal: true

module Api
  module V1
    class StatisticsController < ApplicationController
      before_action :authenticate_user!

      def show
        records = current_user.records.includes(:work)

        render json: {
          by_genre: count_by_genre(records),
          by_status: count_by_status(records),
          monthly_completions: monthly_completions(records),
          totals: totals(records)
        }
      end

      private

      def count_by_genre(records)
        # Rails 8 + PostgreSQLではenum文字列キーで返る
        counts = records.joins(:work).group('works.media_type').count
        Work.media_types.keys.index_with { |genre| counts[genre] || 0 }
      end

      def count_by_status(records)
        # Rails 8 + PostgreSQLではenum文字列キーで返る
        counts = records.group(:status).count
        Record.statuses.keys.index_with { |status| counts[status] || 0 }
      end

      def monthly_completions(records)
        # 過去12ヶ月の月初からの完了記録を集計
        start_date = 11.months.ago.beginning_of_month.to_date
        completed = records.where(status: :completed)
                           .where(completed_at: start_date..)
                           .group("to_char(completed_at, 'YYYY-MM')")
                           .count

        # 過去12ヶ月分を古い順に並べて返す（データなし月はゼロ埋め）
        (0..11).map do |i|
          month = i.months.ago.strftime('%Y-%m')
          { month: month, count: completed[month] || 0 }
        end.reverse
      end

      def totals(records)
        # アニメ・ドラマはepisode単位、漫画・本はvolume単位で集計
        episode_types = Work.media_types.values_at('anime', 'drama')
        volume_types = Work.media_types.values_at('manga', 'book')

        episodes = records.joins(:work).where(works: { media_type: episode_types }).sum(:current_episode)
        volumes = records.joins(:work).where(works: { media_type: volume_types }).sum(:current_episode)

        { episodes_watched: episodes, volumes_read: volumes }
      end
    end
  end
end
