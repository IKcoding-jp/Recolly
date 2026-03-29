# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::UserRecords', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }

  describe 'GET /api/v1/users/:user_id/records' do
    it '公開記録のみ返す' do
      Record.create!(user: user, work: anime_work, status: :watching, visibility: :public_record)
      Record.create!(user: user, work: movie_work, status: :watching, visibility: :private_record)

      get "/api/v1/users/#{user.id}/records"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('テストアニメ')
    end

    it '非公開記録は返さない' do
      Record.create!(user: user, work: anime_work, status: :watching, visibility: :private_record)

      get "/api/v1/users/#{user.id}/records"
      json = response.parsed_body
      expect(json['records']).to be_empty
    end

    it '認証なしでもアクセスできる' do
      get "/api/v1/users/#{user.id}/records"
      expect(response).to have_http_status(:ok)
    end

    it 'media_type でフィルタリングできる' do
      Record.create!(user: user, work: anime_work, status: :watching, visibility: :public_record)
      Record.create!(user: user, work: movie_work, status: :watching, visibility: :public_record)

      get "/api/v1/users/#{user.id}/records?media_type=anime"
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['media_type']).to eq('anime')
    end

    it 'ページネーションが動作する' do
      anime_work_second = Work.create!(title: 'テストアニメ2', media_type: :anime)
      Record.create!(user: user, work: anime_work, status: :watching, visibility: :public_record)
      Record.create!(user: user, work: anime_work_second, status: :watching, visibility: :public_record)

      get "/api/v1/users/#{user.id}/records?page=1&per_page=1"
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['meta']['total_count']).to eq(2)
      expect(json['meta']['total_pages']).to eq(2)
    end
  end
end
