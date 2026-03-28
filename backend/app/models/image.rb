# frozen_string_literal: true

class Image < ApplicationRecord
  # ポリモーフィック関連: Work, User, EpisodeReview等と紐づく
  belongs_to :imageable, polymorphic: true

  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
  ALLOWED_IMAGEABLE_TYPES = %w[Work].freeze
  MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB

  validates :s3_key, presence: true, uniqueness: true
  validates :imageable_type, inclusion: {
    in: ALLOWED_IMAGEABLE_TYPES,
    message: 'は許可されていないタイプです'
  }
  validates :file_name, presence: true
  validates :content_type, presence: true, inclusion: {
    in: ALLOWED_CONTENT_TYPES,
    message: 'は対応していない形式です'
  }
  validates :file_size, presence: true, numericality: {
    less_than_or_equal_to: MAX_FILE_SIZE,
    message: 'は10MB以下にしてください'
  }
end
