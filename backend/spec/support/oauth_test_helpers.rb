# frozen_string_literal: true

# OAuthユーザー作成用ヘルパー（パスワードなし・バリデーションスキップ）
def create_oauth_only_user(username:, email: '', provider: 'google_oauth2', provider_uid: '12345')
  user = User.new(username: username, email: email)
  user.save!(validate: false)
  user.update_column(:encrypted_password, '') # rubocop:disable Rails/SkipsModelValidations
  UserProvider.create!(user: user, provider: provider, provider_uid: provider_uid)
  user
end
