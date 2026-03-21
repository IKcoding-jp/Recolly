# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Registrations', type: :request do
  describe 'POST /api/v1/signup（ユーザー登録）' do
    let(:valid_params) do
      {
        user: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          password_confirmation: 'password123'
        }
      }
    end

    context '正常系' do
      it '有効なパラメータで登録成功（201）' do
        post user_registration_path, params: valid_params, as: :json
        expect(response).to have_http_status(:created)
      end

      it 'レスポンスにユーザー情報が含まれる' do
        post user_registration_path, params: valid_params, as: :json
        json = response.parsed_body
        expect(json['user']['email']).to eq('new@example.com')
        expect(json['user']['username']).to eq('newuser')
      end

      it 'レスポンスにパスワードが含まれない' do
        post user_registration_path, params: valid_params, as: :json
        json = response.parsed_body
        expect(json['user']).not_to have_key('encrypted_password')
        expect(json['user']).not_to have_key('password')
      end

      it 'Userレコードが作成される' do
        expect do
          post user_registration_path, params: valid_params, as: :json
        end.to change(User, :count).by(1)
      end
    end

    context '異常系' do
      it 'emailが空で登録失敗（422）' do
        post user_registration_path,
             params: { user: valid_params[:user].merge(email: '') },
             as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'emailの形式が不正で登録失敗（422）' do
        post user_registration_path,
             params: { user: valid_params[:user].merge(email: 'invalid') },
             as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it '既に登録済みのemailで登録失敗（422）' do
        User.create!(username: 'existing', email: 'new@example.com', password: 'password123')
        post user_registration_path, params: valid_params, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'passwordが短すぎて登録失敗（422）' do
        post user_registration_path,
             params: { user: valid_params[:user].merge(password: 'short', password_confirmation: 'short') },
             as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'passwordが空で登録失敗（422）' do
        post user_registration_path,
             params: { user: valid_params[:user].merge(password: '', password_confirmation: '') },
             as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'usernameが空で登録失敗（422）' do
        post user_registration_path,
             params: { user: valid_params[:user].merge(username: '') },
             as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
