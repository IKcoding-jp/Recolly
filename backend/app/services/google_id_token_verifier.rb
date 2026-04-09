# frozen_string_literal: true

# GoogleのID Token（JWT）を検証して、ユーザー情報を取り出すサービス。
#
# 検証ロジックはgoogleauth gemの `Google::Auth::IDTokens.verify_oidc` に委譲する。
# 検証内容は以下:
#   - JWT署名（Googleの公開鍵で検証）
#   - audience（client_idが一致すること）
#   - issuer（accounts.google.comであること）
#   - 有効期限
#
# 検証に失敗すると `Google::Auth::IDTokens::VerificationError` のサブクラスが raise される。
# 呼び出し側（Controller）で rescue して401返却する責務を持つ。
#
# 認証系の検証ロジックを自前で書くのはセキュリティホールの原因になるため、
# 必ずgoogleauth gemを介して行う（ADR-0035参照）。
class GoogleIdTokenVerifier
  def initialize(credential:)
    @credential = credential
  end

  def call
    raise ArgumentError, 'credential is blank' if @credential.blank?

    payload = Google::Auth::IDTokens.verify_oidc(@credential, aud: client_id)
    {
      sub: payload['sub'],
      email: payload['email'],
      name: payload['name']
    }
  end

  private

  def client_id
    ENV.fetch('GOOGLE_CLIENT_ID')
  end
end
