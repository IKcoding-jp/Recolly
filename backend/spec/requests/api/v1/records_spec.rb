# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Records', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:existing_work) { Work.create!(title: '既存作品', media_type: 'anime') }

  describe 'POST /api/v1/records' do
    context '認証済み' do
      before { sign_in user }

      it '既存Workへの記録追加で201を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['record']['work_id']).to eq(existing_work.id)
        expect(json['record']['status']).to eq('plan_to_watch')
      end

      it 'work_data からWorkを作成して記録追加（検索結果から記録）' do
        params = { record: { work_data: { title: '新規作品', media_type: 'anime',
                                          external_api_id: '99999', external_api_source: 'anilist' } } }
        expect do
          post '/api/v1/records', params: params, as: :json
        end.to change(Work, :count).by(1).and change(Record, :count).by(1)
        expect(response).to have_http_status(:created)
      end

      it '同じexternal_api_id + sourceのWorkが既存なら再利用する' do
        Work.create!(title: '既存外部作品', media_type: 'anime',
                     external_api_id: '99999', external_api_source: 'anilist')
        params = { record: { work_data: { title: '既存外部作品', media_type: 'anime',
                                          external_api_id: '99999', external_api_source: 'anilist' } } }
        expect do
          post '/api/v1/records', params: params, as: :json
        end.not_to change(Work, :count)
        expect(Record.count).to eq(1)
      end

      it '同じ作品を二重記録しようとすると422' do
        Record.create!(user: user, work: existing_work)
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'work_id も work_data もない場合は422' do
        post '/api/v1/records', params: { record: {} }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
