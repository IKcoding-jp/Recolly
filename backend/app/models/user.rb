# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :omniauthable, omniauth_providers: %i[google_oauth2]

  has_many :user_providers, dependent: :destroy
  has_many :records, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :discussions, dependent: :destroy

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

  # OAuthユーザーはencrypted_passwordをクリアするためsaltがnilになる。
  # その場合はid + created_atをベースにした固定値をrememberable_valueとして使用する
  def rememberable_value
    salt = authenticatable_salt.presence
    return salt if salt

    Digest::SHA256.hexdigest("#{id}-#{created_at.to_i}")
  end
end
