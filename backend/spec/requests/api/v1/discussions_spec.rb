# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Discussions', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime, total_episodes: 12) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }

  # Discussionのテストデータ作成前にRecordが必要（workとuserの関連を担保）
  before { Record.create!(user: user, work: anime_work, status: :watching) }

  describe 'GET /api/v1/works/:work_id/discussions' do
    let!(:episode_one_disc) do
      Discussion.create!(title: '1話の感想', body: '面白かった' * 10, episode_number: 1,
                         user: user, work: anime_work)
    end
    let!(:episode_two_disc) do
      Discussion.create!(title: '2話の感想', body: 'さらに面白い' * 10, episode_number: 2,
                         user: user, work: anime_work)
    end
    let!(:general_disc) do
      Discussion.create!(title: '全体の考察', body: '伏線がすごい' * 10,
                         user: user, work: anime_work)
    end

    it '指定した作品のDiscussionを返す' do
      get "/api/v1/works/#{anime_work.id}/discussions", as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussions'].length).to eq(3)
    end

    it '認証なしでもアクセスできる' do
      get "/api/v1/works/#{anime_work.id}/discussions", as: :json
      expect(response).to have_http_status(:ok)
    end

    it 'episode_numberでフィルタリングできる' do
      get "/api/v1/works/#{anime_work.id}/discussions?episode_number=1", as: :json
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
      expect(json['discussions'][0]['episode_number']).to eq(1)
    end

    it 'デフォルトで新しい順（created_at DESC）にソートされる' do
      get "/api/v1/works/#{anime_work.id}/discussions", as: :json
      json = response.parsed_body
      ids = json['discussions'].pluck('id')
      expect(ids).to eq([general_disc.id, episode_two_disc.id, episode_one_disc.id])
    end

    it 'ユーザー情報（username, avatar_url）を含む' do
      get "/api/v1/works/#{anime_work.id}/discussions", as: :json
      json = response.parsed_body
      user_data = json['discussions'][0]['user']
      expect(user_data['username']).to eq('testuser')
      expect(user_data).to have_key('avatar_url')
    end

    it 'ページネーションが動作する' do
      get "/api/v1/works/#{anime_work.id}/discussions?page=1&per_page=2", as: :json
      json = response.parsed_body
      expect(json['discussions'].length).to eq(2)
      expect(json['meta']['current_page']).to eq(1)
      expect(json['meta']['total_pages']).to eq(2)
      expect(json['meta']['total_count']).to eq(3)
    end
  end

  describe 'GET /api/v1/discussions' do
    let!(:anime_disc) do
      Discussion.create!(title: 'アニメの話題', body: 'アニメについて語る' * 10,
                         user: user, work: anime_work)
    end
    let!(:movie_disc) do
      Record.create!(user: user, work: movie_work, status: :completed)
      Discussion.create!(title: '映画の話題', body: '映画について語る' * 10,
                         user: user, work: movie_work)
    end

    it '全作品のDiscussionを返す' do
      get '/api/v1/discussions', as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussions'].length).to eq(2)
    end

    it 'media_typeでフィルタリングできる' do
      get '/api/v1/discussions?media_type=anime', as: :json
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
      expect(json['discussions'][0]['title']).to eq('アニメの話題')
    end

    it 'work_idでフィルタリングできる' do
      get "/api/v1/discussions?work_id=#{movie_work.id}", as: :json
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
      expect(json['discussions'][0]['title']).to eq('映画の話題')
    end

    it 'sort=most_commentsでコメント数の多い順にソートされる' do
      # anime_discにコメントを2件追加
      Comment.create!(body: 'コメント1', discussion: anime_disc, user: user)
      Comment.create!(body: 'コメント2', discussion: anime_disc, user: user)
      anime_disc.reload

      get '/api/v1/discussions?sort=most_comments', as: :json
      json = response.parsed_body
      ids = json['discussions'].pluck('id')
      # anime_disc(コメント2件)が先、movie_disc(コメント0件)が後
      expect(ids).to eq([anime_disc.id, movie_disc.id])
    end

    it '作品情報（title, media_type, cover_image_url）を含む' do
      get '/api/v1/discussions', as: :json
      json = response.parsed_body
      work_data = json['discussions'][0]['work']
      expect(work_data).to have_key('title')
      expect(work_data).to have_key('media_type')
      expect(work_data).to have_key('cover_image_url')
    end
  end

  describe 'GET /api/v1/discussions/:id' do
    let!(:discussion) do
      Discussion.create!(title: '詳細テスト', body: 'これは長い本文です。' * 50,
                         episode_number: 3, user: user, work: anime_work)
    end

    it 'Discussion詳細を本文全体と共に返す' do
      get "/api/v1/discussions/#{discussion.id}", as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussion']['id']).to eq(discussion.id)
      expect(json['discussion']['title']).to eq('詳細テスト')
      # 本文が切り詰められずに全文返される
      expect(json['discussion']['body']).to eq('これは長い本文です。' * 50)
    end

    it '存在しないIDで404を返す' do
      get '/api/v1/discussions/999999', as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
