require 'rails_helper'

RSpec.describe 'Api::V1::MediaPreferenceProfiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/media_preference_profiles' do
    it '未認証なら401を返す' do
      get '/api/v1/media_preference_profiles', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '認証済み — 記録がない場合' do
      before { sign_in user }

      it '6メディア全てno_recordsで返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.length).to eq(6)
        expect(json.all? { |p| p['status'] == 'no_records' }).to be true
      end

      it 'media_typeの順序がanime/movie/drama/book/manga/gameであること' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.pluck('media_type')).to eq(%w[anime movie drama book manga game])
      end
    end

    context '認証済み — アニメ記録が2件（不足）の場合' do
      before do
        sign_in user
        2.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'アニメがinsufficient_recordsで返ること' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('insufficient_records')
        expect(anime['record_count']).to eq(2)
        expect(anime['required_count']).to eq(3)
      end
    end

    context '認証済み — アニメのプロファイルがDBにある場合' do
      before do
        sign_in user
        5.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
        MediaPreferenceProfile.create!(
          user: user,
          media_type: :anime,
          analysis_summary: 'テスト分析',
          preference_scores: [{ 'label' => '感情', 'score' => 9.0 }],
          same_media_works: [{ 'title' => '葬送のフリーレン' }],
          cross_media_works: [],
          top_tags: [],
          record_count: 5,
          analyzed_at: Time.current
        )
      end

      it 'アニメがreadyで分析結果を返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('ready')
        expect(anime['analysis_summary']).to eq('テスト分析')
        expect(anime['same_media_works'].first['title']).to eq('葬送のフリーレン')
      end
    end

    context '認証済み — アニメ記録は3件以上だがプロファイルなし' do
      before do
        sign_in user
        3.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'アニメがgeneratingを返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('generating')
      end
    end
  end
end
