# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::FavoriteWorks', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }
  let(:drama_work) { Work.create!(title: 'テストドラマ', media_type: :drama) }

  describe 'GET /api/v1/users/:id/favorite_works' do
    it 'お気に入り作品を position 順で返す' do
      FavoriteWork.create!(user: user, work: movie_work, position: 2)
      FavoriteWork.create!(user: user, work: anime_work, position: 1)

      get "/api/v1/users/#{user.id}/favorite_works"
      expect(response).to have_http_status(:ok)

      json = response.parsed_body
      favorites = json['favorite_works']
      expect(favorites.length).to eq(2)
      expect(favorites.first['position']).to eq(1)
    end

    it '作品情報とdisplay_modeを含む' do
      FavoriteWork.create!(user: user, work: anime_work, position: 1)

      get "/api/v1/users/#{user.id}/favorite_works"
      json = response.parsed_body
      expect(json['favorite_works'].first['work']['title']).to eq('テストアニメ')
      expect(json['display_mode']).to eq('ranking')
    end

    it '認証なしでもアクセスできる' do
      get "/api/v1/users/#{user.id}/favorite_works"
      expect(response).to have_http_status(:ok)
    end

    it '存在しないユーザーは404' do
      get '/api/v1/users/999999/favorite_works'
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'PUT /api/v1/profile/favorite_works' do
    before { sign_in user }

    it 'お気に入り作品を一括設定できる' do
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: anime_work.id, position: 1 },
          { work_id: movie_work.id, position: 2 }
        ]
      }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['favorite_works'].length).to eq(2)
      expect(user.favorite_works.count).to eq(2)
    end

    it '既存のお気に入りを置き換える' do
      FavoriteWork.create!(user: user, work: anime_work, position: 1)
      FavoriteWork.create!(user: user, work: movie_work, position: 2)

      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: drama_work.id, position: 1 }
        ]
      }
      expect(response).to have_http_status(:ok)
      expect(user.favorite_works.count).to eq(1)
      expect(user.favorite_works.first.work).to eq(drama_work)
    end

    it '空配列で全削除できる' do
      FavoriteWork.create!(user: user, work: anime_work, position: 1)

      put '/api/v1/profile/favorite_works', params: { favorite_works: [] }
      expect(response).to have_http_status(:ok)
      expect(user.favorite_works.count).to eq(0)
    end

    it '6件以上はエラー' do
      works = (1..6).map { |i| Work.create!(title: "作品#{i}", media_type: :anime) }
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: works.each_with_index.map { |w, i| { work_id: w.id, position: i + 1 } }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '同じwork_idの重複はエラー' do
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: anime_work.id, position: 1 },
          { work_id: anime_work.id, position: 2 }
        ]
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '未認証の場合401' do
      sign_out user
      put '/api/v1/profile/favorite_works', params: { favorite_works: [] }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
