# frozen_string_literal: true

# ロックアウト状態のユーザーを検出する Rake タスク（Issue #110）。
# 「password_set_at が NULL かつ OAuth 連携が空」の状態は、
# ユーザーがどのログイン手段も持たないことを意味する（ADR-0036）。
namespace :lockout do
  desc 'ロックアウト状態（password_set_at が NULL かつ OAuth連携なし）のユーザーを検出'
  task detect: :environment do
    locked = User.where(password_set_at: nil).where.missing(:user_providers)
    puts "ロックアウト状態のユーザー: #{locked.count}件"
    locked.find_each do |u|
      puts "  - id=#{u.id} username=#{u.username} email=#{u.email} created_at=#{u.created_at}"
    end
  end
end
