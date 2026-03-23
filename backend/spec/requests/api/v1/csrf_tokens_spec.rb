# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CSRF Tokens', type: :request do
  describe 'GET /api/v1/csrf_token' do
    it 'CSRFトークンを返す' do
      get '/api/v1/csrf_token'
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['token']).to be_present
    end
  end
end
