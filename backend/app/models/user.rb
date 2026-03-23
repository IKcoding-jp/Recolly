# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :omniauthable, omniauth_providers: %i[google_oauth2]

  has_many :user_providers, dependent: :destroy
  has_many :records, dependent: :destroy

  validates :username, presence: true, uniqueness: true,
                       length: { minimum: 2, maximum: 30 }

  # OAuth専用ユーザーはパスワードなしを許可
  def password_required?
    return false if user_providers.any?

    super
  end

  # OAuth専用ユーザーはメールなしを許可（将来のプロバイダー追加に備えて維持）
  def email_required?
    return false if user_providers.any?

    super
  end
end
