# frozen_string_literal: true

class FavoriteWork < ApplicationRecord
  belongs_to :user
  belongs_to :work

  validates :position, presence: true,
                       inclusion: { in: 1..5 },
                       uniqueness: { scope: :user_id }
  validates :work_id, uniqueness: { scope: :user_id }
end
