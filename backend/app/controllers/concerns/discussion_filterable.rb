# frozen_string_literal: true

# Discussionの一覧取得時に使うフィルタリング・ソートのロジックを共通化するconcern
module DiscussionFilterable
  extend ActiveSupport::Concern

  private

  def apply_discussion_filters(discussions)
    discussions = filter_by_episode_number(discussions)
    discussions = filter_by_media_type(discussions)
    filter_by_work_id(discussions)
  end

  def filter_by_episode_number(discussions)
    return discussions if params[:episode_number].blank?

    discussions.where(episode_number: params[:episode_number])
  end

  def filter_by_media_type(discussions)
    return discussions if params[:media_type].blank?

    discussions.joins(:work).where(works: { media_type: params[:media_type] })
  end

  def filter_by_work_id(discussions)
    return discussions if params[:work_id].blank?

    discussions.where(work_id: params[:work_id])
  end

  def apply_discussion_sort(discussions)
    case params[:sort]
    when 'most_comments'
      discussions.order(comments_count: :desc, created_at: :desc)
    else
      discussions.order(created_at: :desc)
    end
  end
end
