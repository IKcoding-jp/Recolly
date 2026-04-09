# frozen_string_literal: true

require 'rails_helper'

# User/UserProviderの2つが同時に変化しないことを検証する用の否定マッチャを定義
RSpec::Matchers.define_negated_matcher :not_change, :change

RSpec.describe 'Api::V1::GoogleIdTokenSessions', type: :request do
  let(:credential) { 'dummy.id.token' }
  let(:google_sub) { 'google_sub_12345' }
  let(:google_email) { 'googleuser@gmail.com' }
  let(:verified_payload) do
    { sub: google_sub, email: google_email, name: 'Google User' }
  end

  # GoogleIdTokenVerifierをstubして、実際のGoogle通信をしないようにする。
  # allow_any_instance_ofを避けるため、GoogleIdTokenVerifier.newをstubして
  # 事前に作ったダブルを返す形にする
  def stub_verifier(payload: verified_payload, error: nil)
    verifier_double = instance_double(GoogleIdTokenVerifier)
    if error
      allow(verifier_double).to receive(:call).and_raise(error)
    else
      allow(verifier_double).to receive(:call).and_return(payload)
    end
    allow(GoogleIdTokenVerifier).to receive(:new).and_return(verifier_double)
  end

  before { stub_verifier }

  describe 'POST /api/v1/auth/google_id_token' do
    context '既存ユーザー（UserProvider一致）' do
      let!(:existing_user) do
        user = User.create!(username: 'existing', email: google_email, password: 'password123')
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: google_sub)
        user
      end

      it 'statusがsuccessでユーザー情報が返る（200）' do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['status']).to eq('success')
        expect(json['user']['id']).to eq(existing_user.id)
        expect(json['user']['email']).to eq(google_email)
      end

      it 'セッションCookieがセットされる' do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.include?('_recolly_session') }).to be true
      end

      it 'remember_me Cookieがセットされる' do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        set_cookies = Array(response.headers['Set-Cookie'])
        expect(set_cookies.any? { |c| c.match?(/remember_user_token/) }).to be true
      end
    end

    context '新規ユーザー（UserProviderなし・メール衝突なし）' do
      it 'statusがnew_userを返す（200）' do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['status']).to eq('new_user')
      end

      it 'User/UserProviderはまだ作成されない' do
        expect do
          post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        end.to not_change(User, :count).and not_change(UserProvider, :count)
      end
    end

    context 'メール衝突（既存のパスワードユーザーと同じメール）' do
      before do
        User.create!(username: 'passworduser', email: google_email, password: 'password123')
      end

      it '409 Conflictとerror codeを返す（error/code/message統一形式）', :aggregate_failures do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:conflict)
        json = response.parsed_body
        expect(json['status']).to eq('error')
        expect(json['code']).to eq('email_already_registered')
        expect(json['message']).to be_present
        expect(json['error']).to eq(json['message'])
      end
    end

    context 'メール衝突（別プロバイダ連携済みの既存ユーザー）' do
      before do
        other_user = User.create!(username: 'otheruser', email: google_email, password: 'password123')
        UserProvider.create!(user: other_user, provider: 'other_provider', provider_uid: 'other_uid')
      end

      it '409 Conflictとemail_registered_with_other_providerを返す（統一形式）', :aggregate_failures do
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:conflict)
        json = response.parsed_body
        expect(json['status']).to eq('error')
        expect(json['code']).to eq('email_registered_with_other_provider')
        expect(json['message']).to be_present
        expect(json['error']).to eq(json['message'])
      end
    end

    context 'ID Token検証エラー' do
      it '署名検証エラー → 401 + unauthorized code' do
        stub_verifier(error: Google::Auth::IDTokens::SignatureError.new('bad'))
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:unauthorized)
        json = response.parsed_body
        expect(json['code']).to eq('unauthorized')
        expect(json['error']).to be_present
        expect(json['message']).to eq(json['error'])
      end

      it 'audienceミスマッチ → 401 + unauthorized code' do
        stub_verifier(error: Google::Auth::IDTokens::AudienceMismatchError.new('bad'))
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body['code']).to eq('unauthorized')
      end

      it '有効期限切れ → 401 + unauthorized code' do
        stub_verifier(error: Google::Auth::IDTokens::ExpiredTokenError.new('bad'))
        post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body['code']).to eq('unauthorized')
      end
    end

    context 'パラメータ不正' do
      it 'credentialが欠落している → 400 + bad_request code' do
        post '/api/v1/auth/google_id_token', params: {}, as: :json
        expect(response).to have_http_status(:bad_request)
        json = response.parsed_body
        expect(json['code']).to eq('bad_request')
        expect(json['error']).to be_present
      end
    end
  end
end
