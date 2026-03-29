# frozen_string_literal: true

class Api::V1::UserRecordsController < ApplicationController
  # GET /api/v1/users/:user_id/records
  def index
    user = User.find(params[:user_id])
    records = build_query(user)
    paginated = paginate(records)

    render json: {
      records: paginated[:records].map { |r| record_json(r) },
      meta: paginated[:meta]
    }
  end

  private

  def build_query(user)
    records = user.records.where(visibility: :public_record).includes(work: :images)
    records = filter_by_media_type(records)
    apply_sort(records)
  end

  def paginate(records)
    total_count = records.count
    total_pages = [(total_count.to_f / per_page_limit).ceil, 1].max

    {
      records: records.offset((current_page - 1) * per_page_limit).limit(per_page_limit),
      meta: { current_page: current_page, total_pages: total_pages, total_count: total_count, per_page: per_page_limit }
    }
  end

  def current_page
    [params.fetch(:page, 1).to_i, 1].max
  end

  def per_page_limit
    params.fetch(:per_page, 20).to_i.clamp(1, 100)
  end

  def filter_by_media_type(records)
    return records if params[:media_type].blank?

    records.joins(:work).where(works: { media_type: params[:media_type] })
  end

  def apply_sort(records)
    case params[:sort]
    when 'rating' then records.order(rating: :desc)
    when 'title' then records.joins(:work).order('works.title ASC')
    else records.order(updated_at: :desc)
    end
  end

  def record_json(record)
    {
      id: record.id, status: record.status, rating: record.rating,
      current_episode: record.current_episode, updated_at: record.updated_at,
      work: {
        id: record.work.id, title: record.work.title, media_type: record.work.media_type,
        total_episodes: record.work.total_episodes, cover_image_url: record.work.resolved_cover_image_url
      }
    }
  end
end
