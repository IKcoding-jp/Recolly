# frozen_string_literal: true

class Api::V1::ProfilesController < ApplicationController
  # 公開API: 未ログインでもプロフィール閲覧を許可する
  # （CLAUDE.md「全APIエンドポイントに認証チェック必須」の意図的な例外）

  # GET /api/v1/users/:id
  def show
    user = User.find(params[:id])
    records = user.records.includes(:work)

    render json: {
      user: {
        id: user.id, username: user.username, bio: user.bio,
        avatar_url: user.avatar_url, created_at: user.created_at
      },
      statistics: build_statistics(records.where(visibility: :public_record))
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
    # group結果のキーがIntegerかStringかはRails/DB環境に依存するため両方対応
    records.joins(:work).group('works.media_type').count.each_with_object({}) do |(k, v), hash|
      name = k.is_a?(Integer) ? Work.media_types.key(k) : k.to_s
      hash[name] = v if name.present?
    end
  end

  def count_by_status(records)
    records.group(:status).count.each_with_object({}) do |(k, v), hash|
      name = k.is_a?(Integer) ? Record.statuses.key(k) : k.to_s
      hash[name] = v if name.present?
    end
  end
end
