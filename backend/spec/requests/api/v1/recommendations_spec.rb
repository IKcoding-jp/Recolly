require 'rails_helper'

RSpec.describe 'Api::V1::Recommendations', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/recommendations' do
    it '未認証なら401を返す' do
      get '/api/v1/recommendations', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '認証済み — 記録がない場合' do
      before { sign_in user }

      it 'no_recordsステータスを返す' do
        get '/api/v1/recommendations', as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['recommendation']).to be_nil
        expect(json['status']).to eq('no_records')
      end
    end

    context '認証済み — 記録が1〜4件の場合' do
      before do
        sign_in user
        3.times do |i|
          work = Work.create!(title: "作品#{i}", media_type: 'anime')
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'insufficient_recordsステータスを返す' do
        get '/api/v1/recommendations', as: :json
        json = response.parsed_body
        expect(json['status']).to eq('insufficient_records')
        expect(json['recommendation']['record_count']).to eq(3)
        expect(json['recommendation']['required_count']).to eq(5)
        expect(json['recommendation']['genre_stats']).not_to be_empty
      end
    end

    context '認証済み — DBに分析結果がある場合' do
      before do
        sign_in user
        10.times do |i|
          work = Work.create!(title: "作品#{i}", media_type: 'anime')
          user.records.create!(work: work, status: :completed, rating: 8)
        end
        Recommendation.create!(
          user: user,
          analysis_summary: '保存済み分析',
          recommended_works: [{ 'title' => '作品A' }],
          challenge_works: [],
          record_count: 10,
          analyzed_at: Time.current
        )
      end

      it '保存済み結果を返す' do
        get '/api/v1/recommendations', as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['status']).to eq('ready')
        expect(json['recommendation']['analysis']['summary']).to eq('保存済み分析')
        expect(json['recommendation']['recommended_works'].first['title']).to eq('作品A')
      end
    end

    context '認証済み — DBに結果がなく記録が5件以上の場合' do
      before do
        sign_in user
        5.times do |i|
          work = Work.create!(title: "作品#{i}", media_type: 'anime')
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'generatingステータスを返しジョブをキューに入れる' do
        expect do
          get '/api/v1/recommendations', as: :json
        end.to have_enqueued_job(RecommendationRefreshJob)

        json = response.parsed_body
        expect(json['status']).to eq('generating')
      end
    end
  end

  describe 'POST /api/v1/recommendations/refresh' do
    it '未認証なら401を返す' do
      post '/api/v1/recommendations/refresh', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '認証済み' do
      before { sign_in user }

      it 'ジョブをキューに入れて202を返す' do
        expect do
          post '/api/v1/recommendations/refresh', as: :json
        end.to have_enqueued_job(RecommendationRefreshJob).with(user.id)

        expect(response).to have_http_status(:accepted)
        json = response.parsed_body
        expect(json['status']).to eq('processing')
      end
    end
  end
end
