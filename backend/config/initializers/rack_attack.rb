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

  # カウンタの保存先。本番/開発はアプリのキャッシュ（本番=solid_cache / 開発=Redis）を使う。
  # 本番にRedisは無い（ADR-0008でsolid_cache採用）ため、Redis直指定だと接続失敗で
  # フェイルオープンし制限が効かない。Rails.cacheに委ねることで環境ごとの実体に追従する。
  # テストはメモリ（Rails.cacheはnull_storeで計数できないため。専用specも独自Storeに差し替える）。
  cache.store =
    if Rails.env.test?
      ActiveSupport::Cache::MemoryStore.new
    else
      Rails.cache
    end

  # 実クライアントIPを返す。本番はCloudFront→EC2構成で、SG（security_groups.tf）により
  # CloudFront以外のオリジン到達を遮断しているため、CloudFrontが末尾に付与する
  # X-Forwarded-Forの接続元IPが信頼できる（クライアント自称のXFFは先頭側に積まれる）。
  # trusted_proxies未設定だとreq.ipはCloudFrontのエッジIPを返すため、ここで実IPを取り出す。
  # CloudFrontが無い開発/テストではreq.ip（REMOTE_ADDR）にフォールバックする。
  def self.client_ip(req)
    forwarded = req.get_header('HTTP_X_FORWARDED_FOR')
    return req.ip if forwarded.blank?

    forwarded.split(',').map(&:strip).reject(&:empty?).last || req.ip
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
    Rack::Attack.client_ip(req) if req.path == LOGIN_PATH && req.post?
  end

  # ログイン: メール単位（同一アカウントへの総当たりを別IPからされても捕捉）
  throttle('login/email', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    Rack::Attack.auth_email(req) if req.path == LOGIN_PATH && req.post?
  end

  # パスワードリセット送信: IP単位
  throttle('password_reset/ip', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    Rack::Attack.client_ip(req) if req.path == PASSWORD_PATH && req.post?
  end

  # パスワードリセット送信: メール単位（特定アドレスへのメール爆撃を捕捉）
  throttle('password_reset/email', limit: AUTH_ATTEMPT_LIMIT, period: RESET_PERIOD) do |req|
    Rack::Attack.auth_email(req) if req.path == PASSWORD_PATH && req.post?
  end

  # 新規登録: IP単位
  throttle('signup/ip', limit: AUTH_ATTEMPT_LIMIT, period: SIGNUP_PERIOD) do |req|
    Rack::Attack.client_ip(req) if req.path == SIGNUP_PATH && req.post?
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
