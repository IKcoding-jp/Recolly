# frozen_string_literal: true

require 'rails_helper'

# H-1: 認証系エンドポイントのレート制限（rack-attack, ADR-0050）
# rack-attack はテスト環境では既定で無効化しているため、他specへ副作用を出さない。
# このspecだけ around で明示的に有効化し、カウンタを独立したMemoryStoreに差し替えて検証する。
RSpec.describe 'Api::V1 レート制限', type: :request do
  around do |example|
    original_enabled = Rack::Attack.enabled
    original_store = Rack::Attack.cache.store
    Rack::Attack.enabled = true
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    example.run
    Rack::Attack.cache.store = original_store
    Rack::Attack.enabled = original_enabled
  end

  let!(:user) do
    User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
  end

  describe 'POST /api/v1/login（ログイン）' do
    it '同一IPからの連続失敗が上限（5回）を超えると429を返す' do
      5.times do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'wrongpass' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      post user_session_path,
           params: { user: { email: 'test@example.com', password: 'wrongpass' } },
           as: :json
      expect(response).to have_http_status(:too_many_requests)
    end

    it '429レスポンスは統一エラー形式（code: too_many_requests）を返す' do
      6.times do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'wrongpass' } },
             as: :json
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.parsed_body['code']).to eq('too_many_requests')
    end
  end

  describe 'POST /api/v1/password（パスワードリセット送信）' do
    it '同一IPからの連続リクエストが上限（5回）を超えると429を返す' do
      5.times do
        post user_password_path,
             params: { user: { email: 'test@example.com' } },
             as: :json
        expect(response).to have_http_status(:ok)
      end

      post user_password_path,
           params: { user: { email: 'test@example.com' } },
           as: :json
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe 'POST /api/v1/signup（新規登録）' do
    it '同一IPからの連続登録が上限（5回）を超えると429を返す' do
      6.times do |i|
        attrs = { username: "user#{i}", email: "user#{i}@example.com",
                  password: 'password123', password_confirmation: 'password123' }
        post user_registration_path, params: { user: attrs }, as: :json
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
