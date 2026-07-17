# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# ローカル開発用のログイン確認ユーザー。本番環境では絶対に投入しない。
if Rails.env.development?
  User.find_or_create_by!(email: 'test@example.com') do |user|
    user.username = 'testuser'
    user.password = 'password123'
    user.password_confirmation = 'password123'
  end
end
