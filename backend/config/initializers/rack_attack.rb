# frozen_string_literal: true

# 認証系エンドポイントのレート制限（ブルートフォース/濫用対策、ADR-0050 / 診断H-1）。
# 総当たり（1IPからメールを変えて試行）は「IP単位」で、
# リセットメール爆撃（1メール宛に多数IPから試行）は「メール単位」で、別キーで捕捉する。
class Rack::Attack
  # 制限しきい値（マジックナンバー回避のため定数化）。時間経過で自動解除される
  AUTH_ATTEMPT_LIMIT = 5
  LOGIN_PERIOD = 20.seconds
  RESET_PERIOD = 60.seconds
  SIGNUP_PERIOD = 60.seconds

  LOGIN_PATH = '/api/v1/login'
  PASSWORD_PATH = '/api/v1/password'
  SIGNUP_PATH = '/api/v1/signup'

  # カウンタの保存先。本番/開発はRedis、テストはメモリ（Redis非依存・テスト間で独立）
  cache.store =
    if Rails.env.test?
      ActiveSupport::Cache::MemoryStore.new
    else
      ActiveSupport::Cache::RedisCacheStore.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0'))
    end

  # JSONボディ {"user":{"email":...}} からメールアドレスを取り出す。
  # rack-attackのreq.paramsはJSONボディを解釈しないため、ボディを読んで巻き戻す。
  def self.auth_email(req)
    return nil unless req.content_type&.include?('application/json')

    body = req.body.read
    req.body.rewind
    email = JSON.parse(body).dig('user', 'email')
    email.presence&.strip&.downcase
  rescue JSON::ParserError
    nil
  end

  # ログイン: IP単位
  throttle('login/ip', limit: AUTH_ATTEMPT_LIMIT, period: LOGIN_PERIOD) do |req|
    req.ip if req.path == LOGIN_PATH && req.post?
  end

  # ログイン: メール単位（同一アカウントへの総当たりを別IPからされても捕捉）
  throttle('login/email', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    Rack::Attack.auth_email(req) if req.path == LOGIN_PATH && req.post?
  end

  # パスワードリセット送信: IP単位
  throttle('password_reset/ip', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    req.ip if req.path == PASSWORD_PATH && req.post?
  end

  # パスワードリセット送信: メール単位（特定アドレスへのメール爆撃を捕捉）
  throttle('password_reset/email', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    Rack::Attack.auth_email(req) if req.path == PASSWORD_PATH && req.post?
  end

  # 新規登録: IP単位
  throttle('signup/ip', limit: AUTH_ATTEMPT_LIMIT, period: SIGNUP_PERIOD) do |req|
    req.ip if req.path == SIGNUP_PATH && req.post?
  end

  # 429レスポンスはアプリ共通のエラー形式（{error, code, message}）に揃える
  self.throttled_responder = lambda do |request|
    match_data = request.env['rack.attack.match_data'] || {}
    retry_after = (match_data[:period] || RESET_PERIOD).to_i
    message = 'リクエストが多すぎます。しばらく時間をおいて再度お試しください'
    body = { error: message, code: 'too_many_requests', message: message }.to_json

    [429, { 'Content-Type' => 'application/json', 'Retry-After' => retry_after.to_s }, [body]]
  end
end

# テスト環境では既定で無効化する。レート制限を検証するspecだけが明示的に有効化する
# （enabledのままだと、連続リクエストを行う他のrequest specが誤って429になり得るため）。
Rack::Attack.enabled = false if Rails.env.test?
