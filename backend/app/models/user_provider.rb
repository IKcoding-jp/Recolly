# frozen_string_literal: true

class UserProvider < ApplicationRecord
  belongs_to :user

  validates :provider, presence: true
  validates :provider_uid, presence: true
  validates :provider, uniqueness: { scope: :provider_uid }
  validates :provider, uniqueness: { scope: :user_id }

  # ロックアウト防御の最後の砦（ADR-0036, Issue #105）。
  # 「password_set_at が nil かつ 他のプロバイダもない」状態への遷移を destroy 時点で拒否する。
  # User が destroy されている連鎖削除（dependent: :destroy）では発動しない。
  before_destroy :prevent_lockout_on_destroy

  private

  def prevent_lockout_on_destroy
    # User#destroy の連鎖削除は dependent: :delete_all のため callback がそもそも走らない。
    # ここに到達するのは個別の destroy（unlink_provider 等）だけ。
    return if user.password_set_at.present? # パスワード設定済みなら解除OK
    return if user.user_providers.where.not(id: id).exists? # 他のプロバイダがあれば解除OK

    errors.add(:base, '最後のログイン手段は解除できません')
    throw(:abort)
  end
end
