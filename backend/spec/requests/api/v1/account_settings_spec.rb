# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Account Settings', type: :request do
  describe 'DELETE /api/v1/account_settings/unlink_provider' do
    context '複数のログイン手段がある場合' do
      it 'OAuth連携を解除できる' do
        user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
        sign_in user

        expect do
          delete '/api/v1/account_settings/unlink_provider', params: { provider: 'google_oauth2' }, as: :json
        end.to change(UserProvider, :count).by(-1)

        expect(response).to have_http_status(:ok)
      end
    end

    context '最後のログイン手段の場合' do
      it '解除を拒否して422を返す' do
        user = User.new(username: 'oauthonly', email: 'oauth@example.com')
        user.save!(validate: false)
        user.update_column(:encrypted_password, '') # rubocop:disable Rails/SkipsModelValidations
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
        sign_in user

        delete '/api/v1/account_settings/unlink_provider', params: { provider: 'google_oauth2' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['error']).to include('ログイン手段')
      end
    end
  end

  describe 'PUT /api/v1/account_settings/set_password' do
    context 'パスワード未設定のOAuthユーザー' do
      it 'パスワードを設定できる' do
        user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
        sign_in user

        put '/api/v1/account_settings/set_password',
            params: { password: 'newpass123', password_confirmation: 'newpass123' }, as: :json
        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.encrypted_password).to be_present
      end
    end

    context 'パスワード不一致' do
      it '422を返す' do
        user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
        sign_in user

        put '/api/v1/account_settings/set_password',
            params: { password: 'newpass123', password_confirmation: 'wrongpass' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '未ログイン' do
      it '401を返す' do
        put '/api/v1/account_settings/set_password',
            params: { password: 'newpass123', password_confirmation: 'newpass123' }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PUT /api/v1/account_settings/set_email' do
    context 'メール未設定ユーザー' do
      it 'メールアドレスを設定できる' do
        user = create_oauth_only_user(username: 'noemailuser', email: '')
        sign_in user

        put '/api/v1/account_settings/set_email', params: { email: 'new@example.com' }, as: :json
        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.email).to eq('new@example.com')
      end
    end

    context 'メールアドレスが既に使用されている場合' do
      it '422を返す' do
        User.create!(username: 'otheruser', email: 'taken@example.com', password: 'password123')
        user = create_oauth_only_user(username: 'noemailuser', email: '')
        sign_in user

        put '/api/v1/account_settings/set_email', params: { email: 'taken@example.com' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '既にメールアドレスが設定されている場合' do
      it '422を返す' do
        user = User.create!(username: 'testuser', email: 'existing@example.com', password: 'password123')
        sign_in user

        put '/api/v1/account_settings/set_email', params: { email: 'new@example.com' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
