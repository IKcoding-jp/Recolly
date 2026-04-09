# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Passwords', type: :request do
  let!(:user) do
    User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
  end

  describe 'POST /api/v1/password（パスワードリセットリクエスト）' do
    context '正常系' do
      it '登録済みemailでリセットメール送信成功（200）' do
        post user_password_path,
             params: { user: { email: 'test@example.com' } },
             as: :json
        expect(response).to have_http_status(:ok)
      end

      it '送信元アドレスが noreply@recolly.net である' do
        # SES の検証ドメインと一致させるため。回帰防止として明示的に検証する。
        expect do
          post user_password_path,
               params: { user: { email: 'test@example.com' } },
               as: :json
        end.to change { ActionMailer::Base.deliveries.size }.by(1)

        expect(ActionMailer::Base.deliveries.last.from).to eq(['noreply@recolly.net'])
      end
    end

    context '異常系' do
      it '未登録emailでもセキュリティ上同じレスポンスを返す' do
        post user_password_path,
             params: { user: { email: 'unknown@example.com' } },
             as: :json
        # セキュリティ上、登録有無を漏らさないため同じステータスを返す
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe 'PUT /api/v1/password（新パスワード設定）' do
    let(:raw_token) { user.send_reset_password_instructions }
    let(:valid_params) do
      {
        user: {
          reset_password_token: raw_token,
          password: 'newpassword123',
          password_confirmation: 'newpassword123'
        }
      }
    end

    context '正常系' do
      it '有効なトークンでパスワード更新に成功する（200）' do
        put user_password_path, params: valid_params, as: :json

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body['message']).to eq('パスワードを更新しました')
      end

      it '更新後の新パスワードでログインできる' do
        put user_password_path, params: valid_params, as: :json

        user.reload
        expect(user.valid_password?('newpassword123')).to be true
        expect(user.valid_password?('password123')).to be false
      end
    end
  end
end
