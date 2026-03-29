# frozen_string_literal: true

class Api::V1::ProfilesController < ApplicationController
  # GET /api/v1/users/:id
  def show
    user = User.find(params[:id])
    records = user.records.includes(:work)

    render json: {
      user: {
        id: user.id, username: user.username, bio: user.bio,
        avatar_url: user.avatar_url, created_at: user.created_at
      },
      statistics: build_statistics(records)
    }
  end

  private

  def build_statistics(records)
    {
      total_records: records.count,
      completed_count: records.where(status: :completed).count,
      watching_count: records.where(status: :watching).count,
      average_rating: records.where.not(rating: nil).average(:rating)&.round(1)&.to_f,
      by_genre: count_by_genre(records),
      by_status: count_by_status(records)
    }
  end

  def count_by_genre(records)
    records.joins(:work).group('works.media_type').count.transform_keys { |k| Work.media_types.key(k) }
  end

  def count_by_status(records)
    records.group(:status).count.transform_keys { |k| Record.statuses.key(k) }
  end
end
