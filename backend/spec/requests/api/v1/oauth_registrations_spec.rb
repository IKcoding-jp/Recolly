# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'OAuth Registrations', type: :request do
  include ActiveSupport::Testing::TimeHelpers

  describe 'POST /api/v1/auth/complete_registration' do
    let(:credential) { 'dummy.id.token' }
    let(:verified_payload) do
      { sub: 'google_12345', email: 'user@gmail.com', name: 'Test User' }
    end

    # GoogleIdTokenSessionsController経由でsession[:oauth_data]をセットする
    # 以前はOmniAuthコールバックGETで同じことをしていた
    def setup_oauth_session
      verifier_double = instance_double(GoogleIdTokenVerifier, call: verified_payload)
      allow(GoogleIdTokenVerifier).to receive(:new).and_return(verifier_double)
      post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
    end

    context '有効なセッションデータがある場合' do
      before { setup_oauth_session }

      it 'ユーザーとUserProviderを作成して201を返す' do
        expect do
          post '/api/v1/auth/complete_registration',
               params: { username: 'newuser' },
               as: :json
        end.to change(User, :count).by(1)
           .and change(UserProvider, :count).by(1)

        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json.dig('user', 'username')).to eq('newuser')
        expect(json.dig('user', 'email')).to eq('user@gmail.com')
      end

      it '作成されたユーザーのemail_missingがfalse' do
        post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
        json = response.parsed_body
        expect(json.dig('user', 'email_missing')).to be false
      end

      it 'ユーザー名が重複している場合は422を返す' do
        User.create!(username: 'newuser', email: 'other@example.com', password: 'password123')
        post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'ユーザー名が空の場合は422を返す' do
        post '/api/v1/auth/complete_registration', params: { username: '' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'remember_me Cookieがセットされる' do
        post '/api/v1/auth/complete_registration',
             params: { username: 'newuser' },
             as: :json
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.match?(/remember_user_token/) }).to be true
      end
    end

    context 'セッションデータがない場合' do
      it '401を返す' do
        post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'セッションデータの有効期限切れ' do
      before { setup_oauth_session }

      it '401を返す' do
        travel 16.minutes do
          post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end
  end
end
