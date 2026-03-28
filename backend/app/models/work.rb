# frozen_string_literal: true

class Work < ApplicationRecord
  has_many :records, dependent: :destroy
  has_many :images, as: :imageable, dependent: :destroy

  # 仕様書セクション4.3: media_type enum
  enum :media_type, {
    anime: 0,
    movie: 1,
    drama: 2,
    book: 3,
    manga: 4,
    game: 5
  }

  validates :title, presence: true
  validates :media_type, presence: true
  validates :external_api_id, uniqueness: { scope: :external_api_source },
                              allow_nil: true

  # カバー画像（最新の1枚を返す）
  def cover_image
    images.order(created_at: :desc).first
  end

  # カバー画像のURL（S3署名付きURL or 既存のcover_image_urlカラム）
  def resolved_cover_image_url
    if cover_image
      S3PresignService.presign_get(cover_image.s3_key)
    else
      cover_image_url
    end
  end

  # JSONシリアライズ時にS3署名付きURLを使う
  def as_json(options = {})
    super.merge('cover_image_url' => resolved_cover_image_url)
  end
end
