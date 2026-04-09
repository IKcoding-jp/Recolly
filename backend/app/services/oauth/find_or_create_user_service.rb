# frozen_string_literal: true

module Oauth
  # OAuth認証結果から既存ユーザー検索・新規ユーザー判定・メール衝突検出を行うサービス。
  #
  # 引数は検証済みの汎用Hash `{ provider:, uid:, email:, name: }` を受け取る。
  # 以前はOmniAuth形式のauth_data（`info` サブキー持ち）を受け取っていたが、
  # ADR-0035のGIS移行で形式が変わったため汎用化した。
  class FindOrCreateUserService
    def initialize(provider:, uid:, email: nil, name: nil)
      @provider = provider
      @uid = uid
      @email = email
      @name = name
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
