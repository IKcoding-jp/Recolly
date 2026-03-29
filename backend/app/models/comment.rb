# frozen_string_literal: true

class Comment < ApplicationRecord
  belongs_to :discussion, counter_cache: true
  belongs_to :user

  validates :body, presence: true, length: { maximum: 3000 }
end
