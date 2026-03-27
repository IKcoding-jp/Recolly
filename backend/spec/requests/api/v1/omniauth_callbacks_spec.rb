# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'OmniAuth Callbacks', type: :request do
  let(:frontend_url) { ENV.fetch('FRONTEND_URL', 'http://localhost:5173') }

  describe 'GET /api/v1/auth/google_oauth2/callback' do
    context '新規ユーザー' do
      before { mock_google_oauth }

      it 'new_userステータスでフロントにリダイレクト' do
        get '/api/v1/auth/google_oauth2/callback'
        expect(response).to redirect_to("#{frontend_url}/auth/callback?status=new_user")
      end
    end

    context '既存ユーザー（UserProvider一致）' do
      before do
        mock_google_oauth
        user = User.create!(username: 'existing', email: 'user@gmail.com', password: 'password123')
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: 'google_12345')
      end

      it 'successステータスでフロントにリダイレクト' do
        get '/api/v1/auth/google_oauth2/callback'
        expect(response).to redirect_to("#{frontend_url}/auth/callback?status=success")
      end

      it 'remember_me Cookieがセットされる' do
        get '/api/v1/auth/google_oauth2/callback'
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.match?(/remember_user_token/) }).to be true
      end
    end

    context 'メール衝突（パスワード登録済みユーザー）' do
      before do
        mock_google_oauth
        User.create!(username: 'existing', email: 'user@gmail.com', password: 'password123')
      end

      it 'errorステータスでフロントにリダイレクト' do
        get '/api/v1/auth/google_oauth2/callback'
        expect(response).to redirect_to(a_string_including('status=error'))
        expect(response).to redirect_to(a_string_including('message=email_already_registered'))
      end
    end

    context 'ログイン済みユーザーがOAuth連携追加' do
      let(:user) { User.create!(username: 'existing', email: 'existing@example.com', password: 'password123') }

      before do
        mock_google_oauth(email: 'existing@example.com')
        sign_in user
      end

      it 'UserProviderを作成してprovider_linkedでリダイレクト' do
        get '/api/v1/auth/google_oauth2/callback'
        expect(response).to redirect_to(a_string_including('status=provider_linked'))
        expect(user.user_providers.count).to eq(1)
      end
    end
  end
end
