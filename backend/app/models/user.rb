# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  # dependent: :delete_all を使う理由（ADR-0036, Issue #105）:
  # UserProvider#before_destroy にロックアウト防御コールバックがあるため、
  # User#destroy の連鎖削除を dependent: :destroy にすると、各 user_provider の
  # before_destroy が発動して連鎖が止まる（password_set_at が nil の場合）。
  # 連鎖削除では「ユーザー自体がいなくなる＝ロックアウトの心配なし」なので、
  # callback をスキップする delete_all で十分。
  # 個別 destroy（例: AccountSettingsController#unlink_provider）では
  # provider.destroy! を呼ぶので、callback は問題なく発動する。
  has_many :user_providers, dependent: :delete_all
  has_many :records, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :discussions, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :favorite_works, dependent: :destroy
  has_one :recommendation, dependent: :destroy

  validates :username, presence: true, uniqueness: true,
                       length: { minimum: 2, maximum: 30 }
  validates :bio, length: { maximum: 100 }
  validates :favorite_display_mode, inclusion: { in: %w[ranking favorites] }

  # ロックアウト防御の最後の砦（ADR-0036, Issue #105）。
  # encrypted_password が空文字に変わる update を、user_providers が空のときに拒否する。
  # Controller 層の last_login_method? と UserProvider#before_destroy の補完として、
  # Rails console や将来追加の別経路で encrypted_password を直接書き換えられても発動する。
  before_update :prevent_lockout_transition

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

  private

  def prevent_lockout_transition
    return unless encrypted_password_changed?
    return if encrypted_password.present?
    return if user_providers.any?

    errors.add(:base, 'ログイン手段を全て失う変更はできません')
    throw(:abort)
  end
end
