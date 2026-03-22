# frozen_string_literal: true

class UserProvider < ApplicationRecord
  belongs_to :user

  validates :provider, presence: true
  validates :provider_uid, presence: true
  validates :provider, uniqueness: { scope: :provider_uid }
  validates :provider, uniqueness: { scope: :user_id }
end
