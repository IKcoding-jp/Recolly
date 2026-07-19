require 'rails_helper'

RSpec.describe RecommendationService do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:mock_analysis) do
    {
      summary: 'テスト分析',
      preference_scores: [{ 'label' => 'テスト', 'score' => 8.0 }],
      media_recommendations: {
        'anime' => { 'trend' => 'ファンタジー重視',
                     'works' => [{ 'query' => '作品A', 'reason' => '理由A' }] },
        'movie' => { 'trend' => 'アニメの好みから推定',
                     'works' => [{ 'query' => '作品B', 'reason' => '理由B' }] }
      },
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
      top_tags: [{ name: '名作', count: 5 }]
    }
  end

  let(:mock_works) do
    [{ title: '作品A', media_type: 'anime', reason: '理由A' }]
  end

  before do
    allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(mock_analysis) # rubocop:disable RSpec/AnyInstance
    allow_any_instance_of(WorkRecommender).to receive(:recommend).and_return(mock_works) # rubocop:disable RSpec/AnyInstance
  end

  describe '#generate' do
    it '新規にRecommendationを作成する' do
      expect { described_class.new(user).generate }.to change(Recommendation, :count).by(1)
    end

    it '総合の分析結果を保存する' do
      result = described_class.new(user).generate
      expect(result.analysis_summary).to eq('テスト分析')
      expect(result.genre_stats.first['media_type']).to eq('anime')
    end

    it '全6メディアのMediaPreferenceProfileを保存する' do
      expect { described_class.new(user).generate }.to change(MediaPreferenceProfile, :count).by(6)
    end

    it 'メディア別プロファイルにtrendと採用作品を保存する' do
      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'anime')
      expect(profile.analysis_summary).to eq('ファンタジー重視')
      expect(profile.same_media_works.first['title']).to eq('作品A')
    end

    it '分析結果に無いメディアも空のプロファイルを保存する' do
      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'game')
      expect(profile).not_to be_nil
      expect(profile.same_media_works).to eq([])
    end

    it 'メディア別の記録件数を保存する' do
      work = Work.create!(title: 'アニメ作品', media_type: 'anime')
      user.records.create!(work: work, status: :completed, rating: 8)

      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'anime')
      expect(profile.record_count).to eq(1)
    end

    it '既存のRecommendationとプロファイルを更新する' do
      Recommendation.create!(user: user, analysis_summary: '古い分析', analyzed_at: 1.day.ago)
      MediaPreferenceProfile.create!(user: user, media_type: 'anime',
                                     analysis_summary: '古い傾向', analyzed_at: 1.day.ago)

      expect { described_class.new(user).generate }.not_to change(Recommendation, :count)
      expect(user.recommendation.reload.analysis_summary).to eq('テスト分析')
      expect(user.media_preference_profiles.find_by(media_type: 'anime')
                 .analysis_summary).to eq('ファンタジー重視')
    end

    it 'PreferenceAnalyzerがnilを返す場合はnilを返し何も保存しない' do
      allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(nil) # rubocop:disable RSpec/AnyInstance

      expect(described_class.new(user).generate).to be_nil
      expect(Recommendation.count).to eq(0)
      expect(MediaPreferenceProfile.count).to eq(0)
    end
  end

  describe '#fetch' do
    it 'DBに結果があればそれを返す' do
      Recommendation.create!(user: user, analysis_summary: 'キャッシュ済み', analyzed_at: Time.current)
      expect(described_class.new(user).fetch.analysis_summary).to eq('キャッシュ済み')
    end

    it 'DBに結果がなければnilを返す' do
      expect(described_class.new(user).fetch).to be_nil
    end
  end
end
