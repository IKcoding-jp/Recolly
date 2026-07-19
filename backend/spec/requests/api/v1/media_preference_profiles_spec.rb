require 'rails_helper'

RSpec.describe 'Api::V1::MediaPreferenceProfiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_records(count, media_type: 'anime')
    count.times do |i|
      work = Work.create!(title: "#{media_type}作品#{i}", media_type: media_type)
      user.records.create!(work: work, status: :completed, rating: 8)
    end
  end

  describe 'GET /api/v1/media_preference_profiles' do
    it '未認証なら401を返す' do
      get '/api/v1/media_preference_profiles', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '記録が0件の場合' do
      before { sign_in user }

      it '全メディアがno_recordsになる' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.length).to eq(6)
        expect(json.pluck('status').uniq).to eq(['no_records'])
      end
    end

    context '全体の記録が1〜4件の場合' do
      before do
        sign_in user
        create_records(3)
      end

      it '全メディアがinsufficient_recordsになる' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.pluck('status').uniq).to eq(['insufficient_records'])
      end

      it 'メディアごとの記録数を返す' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['record_count']).to eq(3)
      end
    end

    context '全体の記録が5件以上でプロファイル未生成の場合' do
      before do
        sign_in user
        create_records(5)
      end

      it 'generatingを返しジョブを自動起動する' do
        expect do
          get '/api/v1/media_preference_profiles', as: :json
        end.to have_enqueued_job(RecommendationRefreshJob).with(user.id)

        json = response.parsed_body
        expect(json.pluck('status').uniq).to eq(['generating'])
      end
    end

    context 'プロファイル生成済みの場合' do
      before do
        sign_in user
        create_records(5)
        Work.media_types.each_key do |media_type|
          MediaPreferenceProfile.create!(
            user: user,
            media_type: media_type,
            analysis_summary: "#{media_type}の傾向",
            same_media_works: [{ 'title' => "#{media_type}のおすすめ" }],
            analyzed_at: Time.current
          )
        end
      end

      it '記録0件のメディアもreadyでおすすめを返す' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        movie = json.find { |p| p['media_type'] == 'movie' }
        expect(movie['status']).to eq('ready')
        expect(movie['record_count']).to eq(0)
        expect(movie['same_media_works'].first['title']).to eq('movieのおすすめ')
        expect(movie['analysis_summary']).to eq('movieの傾向')
      end

      it 'ジョブを起動しない' do
        expect do
          get '/api/v1/media_preference_profiles', as: :json
        end.not_to have_enqueued_job(RecommendationRefreshJob)
      end
    end
  end
end
