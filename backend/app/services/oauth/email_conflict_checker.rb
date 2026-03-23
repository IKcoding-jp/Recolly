# frozen_string_literal: true

module Oauth
  class EmailConflictChecker
    PROVIDER_DISPLAY_NAMES = {
      'google_oauth2' => 'Google',
      'twitter2' => 'X'
    }.freeze

    def initialize(email:, provider:)
      @email = email
      @provider = provider
    end

    def check
      return nil if @email.blank?

      existing_user = User.find_by(email: @email)
      return nil unless existing_user
      return nil if existing_user.user_providers.exists?(provider: @provider)

      existing_provider = existing_user.user_providers.first
      if existing_provider
        display_name = PROVIDER_DISPLAY_NAMES[existing_provider.provider] || existing_provider.provider
        {
          code: 'email_registered_with_other_provider',
          message: "このメールアドレスは既に#{display_name}で登録されています"
        }
      else
        {
          code: 'email_already_registered',
          message: 'このメールアドレスは既に登録されています。メールアドレスでログインしてください'
        }
      end
    end
  end
end
