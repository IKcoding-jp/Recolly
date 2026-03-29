# frozen_string_literal: true

module Api
  module V1
    class DiscussionsController < ApplicationController
      include DiscussionFilterable

      before_action :authenticate_user!, only: [:create]
      before_action :authorize_record_owner!, only: [:create]
      before_action :set_discussion, only: [:show]

      # GET /api/v1/works/:work_id/discussions
      # GET /api/v1/discussions
      def index
        discussions = filtered_discussions
        page = current_page
        per_page = per_page_limit

        render json: {
          discussions: paginate(discussions, page, per_page).map { |d| discussion_list_json(d) },
          meta: pagination_meta(discussions.count, page, per_page)
        }
      end

      # GET /api/v1/discussions/:id
      def show
        render json: { discussion: discussion_detail_json(@discussion) }
      end

      # POST /api/v1/works/:work_id/discussions
      def create
        discussion = current_user.discussions.build(discussion_params)
        discussion.work_id = params[:work_id]

        if discussion.save
          render json: { discussion: discussion_detail_json(discussion) }, status: :created
        else
          render json: { errors: discussion.errors.full_messages }, status: :unprocessable_content
        end
      end

      private

      # フィルタリング・ソート済みのDiscussionクエリを返す
      def filtered_discussions
        discussions = base_discussions.includes(:user, work: :images)
        discussions = apply_discussion_filters(discussions)
        apply_discussion_sort(discussions)
      end

      # work_idがパラメータにある場合はその作品のDiscussionに絞る
      def base_discussions
        if params[:work_id].present?
          Discussion.where(work_id: params[:work_id])
        else
          Discussion.all
        end
      end

      def current_page
        [params.fetch(:page, 1).to_i, 1].max
      end

      def per_page_limit
        params.fetch(:per_page, 20).to_i.clamp(1, 100)
      end

      def paginate(discussions, page, per_page)
        discussions.offset((page - 1) * per_page).limit(per_page)
      end

      def pagination_meta(total_count, page, per_page)
        total_pages = [(total_count.to_f / per_page).ceil, 1].max
        { current_page: page, total_pages: total_pages, total_count: total_count, per_page: per_page }
      end

      # 指定作品を記録済みのユーザーのみ投稿を許可する
      def authorize_record_owner!
        work_id = params[:work_id] || @discussion&.work_id
        return if current_user.records.exists?(work_id: work_id)

        render json: { error: 'この作品を記録していないため投稿できません' }, status: :forbidden
      end

      def discussion_params
        params.expect(discussion: %i[title body episode_number has_spoiler])
      end

      def set_discussion
        @discussion = Discussion.includes(:user, work: :images).find(params[:id])
      end

      def discussion_list_json(discussion)
        {
          id: discussion.id, title: discussion.title, body: discussion.body.truncate(200),
          episode_number: discussion.episode_number, has_spoiler: discussion.has_spoiler,
          comments_count: discussion.comments_count,
          created_at: discussion.created_at, updated_at: discussion.updated_at,
          user: user_summary_json(discussion.user),
          work: work_summary_json(discussion.work)
        }
      end

      def discussion_detail_json(discussion)
        {
          id: discussion.id, title: discussion.title, body: discussion.body,
          episode_number: discussion.episode_number, has_spoiler: discussion.has_spoiler,
          comments_count: discussion.comments_count,
          created_at: discussion.created_at, updated_at: discussion.updated_at,
          user: user_summary_json(discussion.user),
          work: work_summary_json(discussion.work)
        }
      end

      def user_summary_json(user)
        { id: user.id, username: user.username, avatar_url: user.avatar_url }
      end

      def work_summary_json(work)
        {
          id: work.id, title: work.title, media_type: work.media_type,
          total_episodes: work.total_episodes, cover_image_url: work.resolved_cover_image_url
        }
      end
    end
  end
end
