# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Statistics', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/statistics' do
    before { sign_in user }

    context 'ジャンル・ステータス別カウント' do
      before do
        anime_work = Work.create!(title: 'アニメ', media_type: :anime, total_episodes: 12)
        movie_work = Work.create!(title: '映画', media_type: :movie)
        Record.create!(user: user, work: anime_work, status: :completed,
                       current_episode: 12, completed_at: Date.current)
        Record.create!(user: user, work: movie_work, status: :watching)
      end

      it '200を返す' do
        get '/api/v1/statistics'
        expect(response).to have_http_status(:ok)
      end

      it 'ジャンル別カウントが正しい' do
        get '/api/v1/statistics'
        json = response.parsed_body
        expect(json['by_genre']['anime']).to eq(1)
        expect(json['by_genre']['movie']).to eq(1)
      end

      it 'ステータス別カウントが正しい' do
        get '/api/v1/statistics'
        json = response.parsed_body
        expect(json['by_status']['completed']).to eq(1)
        expect(json['by_status']['watching']).to eq(1)
      end

      it 'episodesの合計が正しい' do
        get '/api/v1/statistics'
        json = response.parsed_body
        expect(json['totals']['episodes_watched']).to eq(12)
      end

      it 'monthly_completionsが12ヶ月分のArrayを返す' do
        get '/api/v1/statistics'
        json = response.parsed_body
        expect(json['monthly_completions']).to be_an(Array)
        expect(json['monthly_completions'].length).to eq(12)
      end
    end

    it '他ユーザーのデータは含まれない' do
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      work = Work.create!(title: 'テスト', media_type: :anime)
      Record.create!(user: other, work: work, status: :completed)

      get '/api/v1/statistics'

      json = response.parsed_body
      expect(json['by_genre'].values.sum).to eq(0)
    end

    it 'レコードがない場合も正常にゼロを返す' do
      get '/api/v1/statistics'

      json = response.parsed_body
      expect(json['by_genre'].values.sum).to eq(0)
      expect(json['totals']['episodes_watched']).to eq(0)
      expect(json['totals']['volumes_read']).to eq(0)
    end

    context '未認証' do
      it '401を返す' do
        sign_out user
        get '/api/v1/statistics'
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
