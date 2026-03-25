# frozen_string_literal: true

class EpisodeReview < ApplicationRecord
  belongs_to :record

  # private/publicはRubyの予約語のため、_recordサフィックスで衝突を回避
  enum :visibility, { private_record: 0, public_record: 1 }, prefix: :visibility

  validates :episode_number, presence: true,
                             numericality: { only_integer: true, greater_than: 0 }
  validates :body, presence: true, length: { maximum: 10_000 }
  # 同一record内でepisode_numberは一意（1エピソードに1レビューのみ）
  validates :episode_number, uniqueness: { scope: :record_id }
  validate :episode_number_within_total

  private

  def episode_number_within_total
    total = record&.work&.total_episodes
    return if total.nil?
    return if episode_number.nil?

    errors.add(:episode_number, "は#{total}以下にしてください") if episode_number > total
  end
end
