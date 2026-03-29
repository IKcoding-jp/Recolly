# frozen_string_literal: true

class Discussion < ApplicationRecord
  belongs_to :work
  belongs_to :user
  has_many :comments, dependent: :destroy

  validates :title, presence: true, length: { maximum: 100 }
  validates :body, presence: true, length: { maximum: 5000 }
  validates :episode_number, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :episode_number_within_total

  private

  def episode_number_within_total
    return if episode_number.nil?
    return if work.nil?
    return if work.total_episodes.nil?

    return unless episode_number > work.total_episodes

    errors.add(:episode_number, "は#{work.total_episodes}以下にしてください")
  end
end
