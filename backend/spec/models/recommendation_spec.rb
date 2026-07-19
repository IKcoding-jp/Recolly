require 'rails_helper'

RSpec.describe Recommendation, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'バリデーション' do
    it 'user_idが必須' do
      recommendation = described_class.new(user: nil)
      expect(recommendation).not_to be_valid
      expect(recommendation.errors[:user]).to include('を入力してください')
    end

    it '同じユーザーに2つ作れない' do
      described_class.create!(user: user)
      duplicate = described_class.new(user: user)
      expect(duplicate).not_to be_valid
    end

    it '有効なデータで保存できる' do
      recommendation = build_recommendation(user)
      expect(recommendation).to be_valid
    end
  end

  describe 'リレーション' do
    it 'userに属する' do
      recommendation = described_class.create!(user: user)
      expect(recommendation.user).to eq(user)
    end

    it 'userからhas_oneでアクセスできる' do
      recommendation = described_class.create!(user: user)
      expect(user.recommendation).to eq(recommendation)
    end
  end

  describe 'jsonbカラム' do
    it 'preference_scoresのデフォルトが空配列' do
      recommendation = described_class.create!(user: user)
      expect(recommendation.preference_scores).to eq([])
    end
  end

  private

  def build_recommendation(target_user)
    described_class.new(
      user: target_user,
      analysis_summary: 'テスト分析',
      preference_scores: [{ label: 'キャラクター重視', score: 9.2 }],
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
      top_tags: [{ name: '名作', count: 5 }],
      record_count: 10,
      analyzed_at: Time.current
    )
  end
end
