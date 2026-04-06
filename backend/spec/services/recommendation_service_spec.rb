require 'rails_helper'

RSpec.describe RecommendationService do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:mock_analysis) do
    {
      summary: 'テスト分析',
      preference_scores: [{ 'label' => 'テスト', 'score' => 8.0 }],
      search_keywords: { 'recommended' => [], 'challenge' => [] },
      reasons: {},
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
      top_tags: [{ name: '名作', count: 5 }]
    }
  end

  let(:mock_recommendations) do
    {
      recommended_works: [{ title: '作品A', media_type: 'anime', reason: '理由A' }],
      challenge_works: [{ title: '作品B', media_type: 'book', reason: '理由B' }]
    }
  end

  before do
    allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(mock_analysis) # rubocop:disable RSpec/AnyInstance
    allow_any_instance_of(WorkRecommender).to receive(:recommend).and_return(mock_recommendations) # rubocop:disable RSpec/AnyInstance
  end

  describe '#generate' do
    context 'DBに結果がない場合' do
      it '新規にRecommendationを作成する' do
        expect { described_class.new(user).generate }.to change(Recommendation, :count).by(1)
      end

      it '分析結果をDBに保存する' do
        result = described_class.new(user).generate
        expect(result.analysis_summary).to eq('テスト分析')
        expect(result.recommended_works.first['title']).to eq('作品A')
        expect(result.challenge_works.first['title']).to eq('作品B')
      end
    end

    context 'DBに既存の結果がある場合' do
      before do
        Recommendation.create!(user: user, analysis_summary: '古い分析', analyzed_at: 1.day.ago)
      end

      it '既存のRecommendationを更新する' do
        expect { described_class.new(user).generate }.not_to change(Recommendation, :count)
        expect(user.recommendation.reload.analysis_summary).to eq('テスト分析')
      end
    end

    context 'PreferenceAnalyzerがnilを返す場合（記録不足）' do
      before do
        allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(nil) # rubocop:disable RSpec/AnyInstance
      end

      it 'nilを返す' do
        result = described_class.new(user).generate
        expect(result).to be_nil
      end
    end
  end

  describe '#fetch' do
    it 'DBに結果があればそれを返す' do
      Recommendation.create!(user: user, analysis_summary: 'キャッシュ済み', analyzed_at: Time.current)
      result = described_class.new(user).fetch
      expect(result.analysis_summary).to eq('キャッシュ済み')
    end

    it 'DBに結果がなければnilを返す' do
      result = described_class.new(user).fetch
      expect(result).to be_nil
    end
  end

  describe '#needs_refresh?' do
    it '結果がなければtrue' do
      expect(described_class.new(user).needs_refresh?).to be true
    end

    it '記録が5件以上増えていればtrue' do
      Recommendation.create!(user: user, record_count: 10, analyzed_at: Time.current)
      15.times do |i|
        work = Work.create!(title: "作品#{i}", media_type: 'anime')
        user.records.create!(work: work, status: :completed)
      end
      expect(described_class.new(user).needs_refresh?).to be true
    end

    it '記録が4件以下の増加ならfalse' do
      Recommendation.create!(user: user, record_count: 10, analyzed_at: Time.current)
      12.times do |i|
        work = Work.create!(title: "作品#{i}", media_type: 'anime')
        user.records.create!(work: work, status: :completed)
      end
      expect(described_class.new(user).needs_refresh?).to be false
    end
  end
end
