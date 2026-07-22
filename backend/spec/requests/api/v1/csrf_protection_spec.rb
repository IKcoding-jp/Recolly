# frozen_string_literal: true

require 'rails_helper'

# M-2: CSRF対策としてカスタムヘッダ（X-Requested-With）を状態変更リクエストに必須化する。
# クロスオリジンからはpreflightで弾かれ、フォーム送信はヘッダを付けられないため成立しない。
# テスト環境では既定で無効化しているため、このspecだけ around で有効化して検証する。
RSpec.describe 'CSRFカスタムヘッダ保護', type: :request do
  around do |example|
    original = Rails.application.config.x.csrf_header_protection
    Rails.application.config.x.csrf_header_protection = true
    example.run
    Rails.application.config.x.csrf_header_protection = original
  end

  let!(:user) do
    User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
  end

  describe '状態変更リクエスト（POST/PUT/PATCH/DELETE）' do
    it 'カスタムヘッダが無いPOSTは403を返す' do
      post user_session_path,
           params: { user: { email: 'test@example.com', password: 'password123' } },
           as: :json
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body['code']).to eq('invalid_request')
    end

    it 'カスタムヘッダがあればCSRFチェックを通過する（ログイン成功200）' do
      post user_session_path,
           params: { user: { email: 'test@example.com', password: 'password123' } },
           headers: { 'X-Requested-With' => 'XMLHttpRequest' },
           as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe '読み取りリクエスト（GET）' do
    it 'GETはカスタムヘッダが無くても通る' do
      sign_in user
      get api_v1_current_user_path, as: :json
      expect(response).to have_http_status(:ok)
    end
  end
end
