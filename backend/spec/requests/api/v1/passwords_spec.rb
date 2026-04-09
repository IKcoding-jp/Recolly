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
end
