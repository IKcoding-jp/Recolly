require 'rails_helper'

RSpec.describe 'ヘルスチェックAPI', type: :request do
  describe 'GET /api/v1/health' do
    it 'ステータス200を返す' do
      get '/api/v1/health'
      expect(response).to have_http_status(:ok)
    end

    it 'status: okを返す' do
      get '/api/v1/health'
      expect(response.parsed_body['status']).to eq('ok')
    end

    it 'timestampを返す' do
      get '/api/v1/health'
      expect(response.parsed_body['timestamp']).to be_present
    end
  end
end
