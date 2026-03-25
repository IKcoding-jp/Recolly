# frozen_string_literal: true

class Tag < ApplicationRecord
  belongs_to :user
  has_many :record_tags, dependent: :destroy

  validates :name, presence: true, length: { maximum: 30 }
  # ユーザーごとに同名タグを禁止（異なるユーザー間は同名可）
  validates :name, uniqueness: { scope: :user_id }
end
