# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/v1/users/me/media_types', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  context '未認証の場合' do
    it '401 を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context '認証済みで記録がない場合' do
    before { sign_in user }

    it '空配列を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ 'media_types' => [] })
    end
  end

  context '認証済みで複数ジャンルの記録がある場合' do
    before do
      sign_in user
      anime_work  = Work.create!(title: 'アニメ作品', media_type: :anime)
      book_work   = Work.create!(title: '本作品', media_type: :book)
      movie_work  = Work.create!(title: '映画作品', media_type: :movie)
      Record.create!(user: user, work: anime_work, status: :watching)
      Record.create!(user: user, work: book_work, status: :watching)
      Record.create!(user: user, work: movie_work, status: :watching)
      another_anime = Work.create!(title: 'アニメ作品2', media_type: :anime)
      Record.create!(user: user, work: another_anime, status: :watching)
    end

    it 'distinct な media_types を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:ok)
      media_types = response.parsed_body['media_types']
      expect(media_types).to contain_exactly('anime', 'book', 'movie')
    end
  end

  context '他ユーザーの記録は含まない' do
    before do
      other_user = User.create!(username: 'otheruser', email: 'other@example.com', password: 'password123')
      other_work = Work.create!(title: 'ゲーム作品', media_type: :game)
      Record.create!(user: other_user, work: other_work, status: :watching)
      sign_in user
    end

    it '自分の記録のみ集計する' do
      get '/api/v1/users/me/media_types'
      expect(response.parsed_body['media_types']).to eq([])
    end
  end
end
