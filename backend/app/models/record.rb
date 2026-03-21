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

  validates :work_id, uniqueness: { scope: :user_id }
  validates :rating, inclusion: { in: 1..5 }, allow_nil: true
end
