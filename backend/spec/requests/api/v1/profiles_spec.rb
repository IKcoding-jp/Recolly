# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Profiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }

  describe 'GET /api/v1/users/:id' do
    it 'ユーザー情報を返す' do
      get "/api/v1/users/#{user.id}"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['user']['username']).to eq('testuser')
    end

    it '統計情報を返す' do
      Record.create!(user: user, work: anime_work, status: :completed, rating: 8, visibility: :public_record)
      Record.create!(user: user, work: movie_work, status: :watching, visibility: :public_record)

      get "/api/v1/users/#{user.id}"
      json = response.parsed_body
      expect(json['statistics']['total_records']).to eq(2)
      expect(json['statistics']['completed_count']).to eq(1)
      expect(json['statistics']['watching_count']).to eq(1)
    end

    it '統計に average_rating, by_genre, by_status を含む' do
      Record.create!(user: user, work: anime_work, status: :completed, rating: 8, visibility: :public_record)
      Record.create!(user: user, work: movie_work, status: :completed, rating: 6, visibility: :public_record)

      get "/api/v1/users/#{user.id}"
      json = response.parsed_body
      stats = json['statistics']
      expect(stats['average_rating']).to eq(7.0)
      expect(stats['by_genre']).to be_a(Hash)
      expect(stats['by_status']).to be_a(Hash)
    end

    it '認証なしでもアクセスできる' do
      get "/api/v1/users/#{user.id}"
      expect(response).to have_http_status(:ok)
    end

    it '存在しないユーザーには404を返す' do
      get '/api/v1/users/999999'
      expect(response).to have_http_status(:not_found)
    end
  end
end
