# frozen_string_literal: true

class Api::V1::CommentsController < ApplicationController
  # indexは公開API（未ログインでも閲覧可能）。create/update/destroyのみ認証必須
  before_action :authenticate_user!, only: %i[create update destroy]
  before_action :set_discussion, only: %i[index create]
  before_action :set_comment, only: %i[update destroy]
  before_action :authorize_record_owner_for_comment!, only: [:create]
  before_action :authorize_comment_author!, only: %i[update destroy]

  # GET /api/v1/discussions/:discussion_id/comments
  def index
    comments = @discussion.comments.includes(:user).order(created_at: :asc)
    paginated = paginate(comments)

    render json: {
      comments: paginated[:records].map { |c| comment_json(c) },
      meta: paginated[:meta]
    }
  end

  # POST /api/v1/discussions/:discussion_id/comments
  def create
    comment = @discussion.comments.build(comment_params)
    comment.user = current_user

    if comment.save
      render json: { comment: comment_json(comment) }, status: :created
    else
      render json: { errors: comment.errors.full_messages }, status: :unprocessable_content
    end
  end

  # PATCH /api/v1/comments/:id
  def update
    if @comment.update(comment_params)
      render json: { comment: comment_json(@comment) }
    else
      render json: { errors: @comment.errors.full_messages }, status: :unprocessable_content
    end
  end

  # DELETE /api/v1/comments/:id
  def destroy
    @comment.destroy!
    head :no_content
  end

  private

  def set_discussion
    @discussion = Discussion.find(params[:discussion_id])
  end

  def set_comment
    @comment = Comment.find(params[:id])
  end

  def authorize_record_owner_for_comment!
    work_id = @discussion.work_id
    return if current_user.records.exists?(work_id: work_id)

    render json: { error: 'この作品を記録していないためコメントできません' }, status: :forbidden
  end

  def authorize_comment_author!
    return if @comment.user_id == current_user.id

    render json: { error: '編集権限がありません' }, status: :forbidden
  end

  def current_page
    [params.fetch(:page, 1).to_i, 1].max
  end

  def per_page_limit
    params.fetch(:per_page, 20).to_i.clamp(1, 100)
  end

  def paginate(scope)
    total_count = scope.count
    total_pages = (total_count.to_f / per_page_limit).ceil

    {
      records: scope.offset((current_page - 1) * per_page_limit).limit(per_page_limit),
      meta: { current_page: current_page, total_pages: [total_pages, 1].max,
              total_count: total_count, per_page: per_page_limit }
    }
  end

  def comment_params
    params.expect(comment: [:body])
  end

  def comment_json(comment)
    {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      edited: comment.created_at != comment.updated_at,
      user: { id: comment.user.id, username: comment.user.username, avatar_url: comment.user.avatar_url }
    }
  end
end
