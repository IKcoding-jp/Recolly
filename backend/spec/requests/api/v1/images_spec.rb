# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Images', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('S3_BUCKET_NAME').and_return('test-bucket')
  end

  describe 'POST /api/v1/images/presign' do
    let(:presign_params) do
      { image: { file_name: 'cover.jpg', content_type: 'image/jpeg', file_size: 1_200_000 } }
    end

    context '認証済み' do
      before do
        sign_in user
        allow(S3PresignService).to receive(:presign_put).and_return('https://s3.example.com/presigned-url')
      end

      it '署名付きURLとs3_keyを返す' do
        post '/api/v1/images/presign', params: presign_params, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['presigned_url']).to eq('https://s3.example.com/presigned-url')
        expect(json['s3_key']).to match(%r{uploads/images/.+\.jpg})
      end

      it '不正なcontent_typeで422' do
        params = { image: { file_name: 'file.pdf', content_type: 'application/pdf', file_size: 1000 } }
        post '/api/v1/images/presign', params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body['error']).to include('対応していないファイル形式')
      end

      it '10MB超のfile_sizeで422' do
        params = { image: { file_name: 'big.jpg', content_type: 'image/jpeg', file_size: 11_000_000 } }
        post '/api/v1/images/presign', params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body['error']).to include('10MB')
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/images/presign', params: presign_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/images' do
    let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
    let(:image_params) do
      {
        image: {
          s3_key: 'uploads/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg',
          file_name: 'cover.jpg',
          content_type: 'image/jpeg',
          file_size: 1_200_000,
          imageable_type: 'Work',
          imageable_id: work.id
        }
      }
    end

    context '認証済み' do
      before do
        sign_in user
        allow(S3PresignService).to receive(:presign_get).and_return('https://s3.example.com/view-url')
        allow(S3DeleteService).to receive(:call)
      end

      it 'メタデータを登録して201を返す' do
        post '/api/v1/images', params: image_params, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['image']['file_name']).to eq('cover.jpg')
        expect(json['image']['url']).to eq('https://s3.example.com/view-url')
      end

      it 'Imageレコードが作成される' do
        expect do
          post '/api/v1/images', params: image_params, as: :json
        end.to change(Image, :count).by(1)
      end

      it '不正なcontent_typeで422 + S3ロールバック' do
        params = image_params.deep_merge(image: { content_type: 'application/pdf' })
        post '/api/v1/images', params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(S3DeleteService).to have_received(:call).with('uploads/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg')
      end

      it '存在しないimageableで422 + S3ロールバック' do
        params = image_params.deep_merge(image: { imageable_id: 999_999 })
        post '/api/v1/images', params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(S3DeleteService).to have_received(:call).with('uploads/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg')
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/images', params: image_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'DELETE /api/v1/images/:id' do
    let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
    let!(:image) do
      Image.create!(
        imageable: work,
        s3_key: 'uploads/images/to-delete.jpg',
        file_name: 'cover.jpg',
        content_type: 'image/jpeg',
        file_size: 1_200_000
      )
    end

    context '認証済み' do
      before do
        sign_in user
        allow(S3DeleteService).to receive(:call)
      end

      it 'DBレコードを削除して204を返す' do
        expect do
          delete "/api/v1/images/#{image.id}", as: :json
        end.to change(Image, :count).by(-1)
        expect(response).to have_http_status(:no_content)
      end

      it 'S3のファイルも削除する' do
        delete "/api/v1/images/#{image.id}", as: :json
        expect(S3DeleteService).to have_received(:call).with('uploads/images/to-delete.jpg')
      end

      it '存在しないIDで404' do
        delete '/api/v1/images/999999', as: :json
        expect(response).to have_http_status(:not_found)
      end
    end

    context '未認証' do
      it '401を返す' do
        delete "/api/v1/images/#{image.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
