# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let!(:user) do
    User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
  end

  describe 'POST /api/v1/login（ログイン）' do
    context '正常系' do
      it '正しい認証情報でログイン成功（200）' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        expect(response).to have_http_status(:ok)
      end

      it 'レスポンスにユーザー情報が含まれる' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        json = response.parsed_body
        expect(json['user']['email']).to eq('test@example.com')
        expect(json['user']['username']).to eq('testuser')
      end

      it 'セッションCookieがセットされる' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        # Set-Cookieは複数Cookie設定時に配列で返るため、any?でパターン検索する
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.include?('_recolly_session') }).to be true
      end

      it 'remember_me Cookieがセットされる' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        # Set-Cookieは複数Cookie設定時に配列で返るため、any?でパターン検索する
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.match?(/remember_user_token/) }).to be true
      end
    end

    context '異常系' do
      it '存在しないemailで認証エラー（401）' do
        post user_session_path,
             params: { user: { email: 'wrong@example.com', password: 'password123' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      it 'パスワードが間違いで認証エラー（401）' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'wrongpass' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      it 'emailが空で認証エラー（401）' do
        post user_session_path,
             params: { user: { email: '', password: 'password123' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'DELETE /api/v1/logout（ログアウト）' do
    context '正常系' do
      it 'ログイン済みユーザーがログアウト成功（200）' do
        sign_in user
        delete destroy_user_session_path, as: :json
        expect(response).to have_http_status(:ok)
      end

      it 'ログアウト後にcurrent_userにアクセスできない' do
        sign_in user
        delete destroy_user_session_path, as: :json
        get api_v1_current_user_path, as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      it 'ログアウト後にremember_me Cookieが削除される' do
        # ログインしてremember_meを設定
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        # ログアウト
        delete destroy_user_session_path, as: :json
        # Set-Cookieは複数Cookie設定時に配列で返るため、any?でパターン検索する
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.match?(/remember_user_token=;/) }).to be true
      end
    end

    context '異常系' do
      it '未ログイン状態でログアウトするとエラー（401）' do
        delete destroy_user_session_path, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
