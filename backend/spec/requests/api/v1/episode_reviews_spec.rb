# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::EpisodeReviews', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テストアニメ', media_type: :anime, total_episodes: 24) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }
  let(:other_record) { Record.create!(user: other_user, work: work, status: :watching) }

  describe 'GET /api/v1/records/:record_id/episode_reviews' do
    context '認証済み' do
      before { sign_in user }

      it '話数感想一覧をepisode_number昇順で返す' do
        EpisodeReview.create!(record: record, episode_number: 3, body: '3話感想')
        EpisodeReview.create!(record: record, episode_number: 1, body: '1話感想')
        EpisodeReview.create!(record: record, episode_number: 2, body: '2話感想')

        get "/api/v1/records/#{record.id}/episode_reviews"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['episode_reviews'].length).to eq(3)
        expect(json['episode_reviews'].map { |r| r['episode_number'] }).to eq([1, 2, 3])
      end

      it '他ユーザーの記録の感想は取得できない' do
        get "/api/v1/records/#{other_record.id}/episode_reviews"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        get "/api/v1/records/#{record.id}/episode_reviews"
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/records/:record_id/episode_reviews' do
    before { sign_in user }

    it '話数感想を作成できる' do
      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '神回だった' } }

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['episode_review']['episode_number']).to eq(1)
      expect(json['episode_review']['body']).to eq('神回だった')
    end

    it '同じ話数の重複作成は422を返す' do
      EpisodeReview.create!(record: record, episode_number: 1, body: '初回')

      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '2回目' } }

      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'bodyが空なら422を返す' do
      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '' } }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'PATCH /api/v1/records/:record_id/episode_reviews/:id' do
    before { sign_in user }

    let!(:review) { EpisodeReview.create!(record: record, episode_number: 1, body: '初版') }

    it '感想を更新できる' do
      patch "/api/v1/records/#{record.id}/episode_reviews/#{review.id}",
            params: { episode_review: { body: '更新版' } }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['episode_review']['body']).to eq('更新版')
    end
  end

  describe 'DELETE /api/v1/records/:record_id/episode_reviews/:id' do
    before { sign_in user }

    let!(:review) { EpisodeReview.create!(record: record, episode_number: 1, body: '削除対象') }

    it '感想を削除できる' do
      delete "/api/v1/records/#{record.id}/episode_reviews/#{review.id}"
      expect(response).to have_http_status(:no_content)
      expect(EpisodeReview.find_by(id: review.id)).to be_nil
    end
  end
end
