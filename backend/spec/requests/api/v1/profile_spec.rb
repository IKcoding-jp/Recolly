# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Profile', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'PATCH /api/v1/profile' do
    context '認証済みの場合' do
      before { sign_in user }

      it 'bioを更新できる' do
        patch '/api/v1/profile', params: { profile: { bio: '自己紹介テスト' } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['user']['bio']).to eq('自己紹介テスト')
        expect(user.reload.bio).to eq('自己紹介テスト')
      end

      it 'avatar_urlを更新できる' do
        patch '/api/v1/profile', params: { profile: { avatar_url: 'uploads/avatars/test.jpg' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.avatar_url).to eq('uploads/avatars/test.jpg')
      end

      it 'favorite_display_modeを更新できる' do
        patch '/api/v1/profile', params: { profile: { favorite_display_mode: 'favorites' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.favorite_display_mode).to eq('favorites')
      end

      it 'bioが100文字を超えるとエラー' do
        patch '/api/v1/profile', params: { profile: { bio: 'あ' * 101 } }
        expect(response).to have_http_status(:unprocessable_content)
      end

      it '不正なfavorite_display_modeはエラー' do
        patch '/api/v1/profile', params: { profile: { favorite_display_mode: 'invalid' } }
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'avatar_urlを空にするとnilになる' do
        user.update!(avatar_url: 'uploads/avatars/old.jpg')
        patch '/api/v1/profile', params: { profile: { avatar_url: '' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.avatar_url).to be_nil
      end
    end

    context '未認証の場合' do
      it '401を返す' do
        patch '/api/v1/profile', params: { profile: { bio: 'test' } }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/profile/presign_avatar' do
    before do
      sign_in user
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('S3_BUCKET_NAME').and_return('test-bucket')
      allow(S3PresignService).to receive(:presign_put).and_return('https://s3.example.com/presigned-url')
    end

    it '署名付きURLを返す' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.jpg', content_type: 'image/jpeg', file_size: 500_000 }
      }
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['presigned_url']).to be_present
      expect(json['s3_key']).to start_with('uploads/avatars/')
    end

    it '対応していないファイル形式はエラー' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.bmp', content_type: 'image/bmp', file_size: 500_000 }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '10MBを超えるファイルはエラー' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.jpg', content_type: 'image/jpeg', file_size: 11_000_000 }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
