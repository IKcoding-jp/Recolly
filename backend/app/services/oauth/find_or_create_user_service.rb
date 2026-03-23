# frozen_string_literal: true

module Oauth
  class FindOrCreateUserService
    def initialize(auth_data)
      @provider = auth_data[:provider]
      @uid = auth_data[:uid]
      @email = auth_data.dig(:info, :email)
      @name = auth_data.dig(:info, :name)
    end

    def call
      # 既存のUserProviderで検索
      user_provider = UserProvider.find_by(provider: @provider, provider_uid: @uid)
      return { status: :existing_user, user: user_provider.user } if user_provider

      # メール衝突チェック
      conflict = EmailConflictChecker.new(email: @email, provider: @provider).check
      return { status: :conflict, error: conflict } if conflict

      # 新規ユーザー登録が必要（ユーザー名入力待ち）
      {
        status: :new_user,
        oauth_data: {
          provider: @provider,
          uid: @uid,
          email: @email,
          name: @name
        }
      }
    end
  end
end
