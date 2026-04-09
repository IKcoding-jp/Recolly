# frozen_string_literal: true

# OAuthユーザー作成用ヘルパー。
# 本番の OauthRegistrationsController と同じロジックで作る：
# - password は SecureRandom の bcrypt ハッシュが残る（本人は知らない値）
# - password_set_at は nil のまま（本人が設定していないため has_password = false 扱い）
def create_oauth_only_user(username:, email: '', provider: 'google_oauth2', provider_uid: '12345')
  user = User.new(username: username, email: email, password: SecureRandom.hex(32))
  user.user_providers.build(provider: provider, provider_uid: provider_uid)
  user.save!
  user
end
