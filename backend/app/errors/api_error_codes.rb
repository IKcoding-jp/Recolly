# frozen_string_literal: true

# API エラーコード定数。
# フロントエンドの lib/errorMessages.ts と対応する。
# 詳細は docs/api-error-codes.md を参照。
module ApiErrorCodes
  EMAIL_ALREADY_REGISTERED             = 'email_already_registered'
  EMAIL_REGISTERED_WITH_OTHER_PROVIDER = 'email_registered_with_other_provider'
  UNAUTHORIZED                         = 'unauthorized'
  INVALID_CREDENTIAL                   = 'invalid_credential'
  BAD_REQUEST                          = 'bad_request'
  LAST_LOGIN_METHOD                    = 'last_login_method'
  PROVIDER_NOT_FOUND                   = 'provider_not_found'
  PROVIDER_ALREADY_LINKED              = 'provider_already_linked'
  PASSWORD_EMPTY                       = 'password_empty'
  PASSWORD_MISMATCH                    = 'password_mismatch'
  EMAIL_ALREADY_SET                    = 'email_already_set'
  EMAIL_TAKEN                          = 'email_taken'
end
