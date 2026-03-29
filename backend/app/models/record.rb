# frozen_string_literal: true

class Record < ApplicationRecord
  belongs_to :user
  belongs_to :work

  # 仕様書セクション4.3: status enum
  enum :status, {
    watching: 0,
    completed: 1,
    on_hold: 2,
    dropped: 3,
    plan_to_watch: 4
  }

  # private/publicはRubyの予約語のため、_recordサフィックスで衝突を回避
  enum :visibility, { private_record: 0, public_record: 1 }, prefix: :visibility

  has_many :episode_reviews, dependent: :destroy
  has_many :record_tags, dependent: :destroy
  has_many :tags, through: :record_tags

  validates :work_id, uniqueness: { scope: :user_id }
  validates :rating, inclusion: { in: 1..10 }, allow_nil: true
  validates :current_episode, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :review_text, length: { maximum: 10_000 }
  validate :started_at_before_completed_at
  validate :current_episode_within_total

  before_save :apply_status_automations
  before_save :auto_complete_on_episode_reach

  private

  def apply_status_automations
    return unless status_changed?

    case status
    when 'watching' then apply_watching_defaults
    when 'completed' then apply_completed_defaults
    when 'plan_to_watch' then reset_for_plan_to_watch
    end
  end

  def apply_watching_defaults
    self.started_at ||= Date.current
  end

  def apply_completed_defaults
    self.completed_at ||= Date.current
    self.started_at ||= Date.current
    self.current_episode = work.total_episodes if work.total_episodes.present?
  end

  def reset_for_plan_to_watch
    self.started_at = nil
    self.completed_at = nil
    self.current_episode = 0
    self.rating = nil
  end

  def auto_complete_on_episode_reach
    return unless should_auto_complete?

    self.status = 'completed'
    self.completed_at ||= Date.current
    self.started_at ||= Date.current
  end

  # エピソード到達による自動完了の判定
  # 連載中（RELEASING）の作品では自動完了しない（完結済み・status未設定のみ対象）
  def should_auto_complete?
    current_episode_changed? &&
      status != 'completed' &&
      work.total_episodes.present? &&
      current_episode >= work.total_episodes &&
      work.metadata&.dig('status') != 'RELEASING'
  end

  def started_at_before_completed_at
    return unless started_at.present? && completed_at.present?
    return unless started_at > completed_at

    errors.add(:started_at, 'は完了日より前である必要があります')
  end

  def current_episode_within_total
    return unless current_episode.present? && work&.total_episodes.present?
    return unless current_episode > work.total_episodes

    errors.add(:current_episode, "は総話数（#{work.total_episodes}）以下である必要があります")
  end
end
