require 'rails_helper'
require 'ostruct'

RSpec.describe WorkRecommender do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:analysis_result) do
    {
      search_keywords: {
        'recommended' => [
          { 'media_type' => 'anime', 'query' => '葬送のフリーレン', 'reason' => '作品Aに9点をつけたあなたへ。' },
          { 'media_type' => 'movie', 'query' => 'パラサイト', 'reason' => '社会派テーマが好きなあなたへ。' }
        ],
        'challenge' => [
          { 'media_type' => 'book', 'query' => 'コンビニ人間', 'reason' => '普段あまり読まないジャンルから。' }
        ]
      }
    }
  end

  let(:mock_search_result) do
    Struct.new(:title, :media_type, :description, :cover_image_url,
               :external_api_id, :external_api_source, :metadata)
          .new(
            title: 'おすすめ作品',
            media_type: 'anime',
            description: 'テスト説明',
            cover_image_url: 'https://example.com/cover.jpg',
            external_api_id: '12345',
            external_api_source: 'anilist',
            metadata: { 'genres' => %w[Fantasy], 'season_year' => 2023 }
          )
  end

  before do
    allow_any_instance_of(WorkSearchService).to receive(:search).and_return([mock_search_result]) # rubocop:disable RSpec/AnyInstance
  end

  describe '#recommend' do
    it 'recommended_worksとchallenge_worksを返す' do
      result = described_class.new(user, analysis_result).recommend
      expect(result[:recommended_works]).not_to be_empty
      expect(result[:challenge_works]).not_to be_empty
    end

    it '各作品にreasonが含まれる' do
      result = described_class.new(user, analysis_result).recommend
      expect(result[:recommended_works].first[:reason]).to include('9点')
    end

    it '作品データに必要なフィールドが全て含まれる' do
      result = described_class.new(user, analysis_result).recommend
      work = result[:recommended_works].first
      expect(work).to include(:title, :media_type, :description, :cover_url,
                              :reason, :external_api_id, :external_api_source, :metadata)
    end

    it '記録済みの作品を除外する' do
      work = Work.create!(title: 'おすすめ作品', media_type: 'anime',
                          external_api_id: '12345', external_api_source: 'anilist')
      user.records.create!(work: work, status: :completed)

      result = described_class.new(user, analysis_result).recommend
      titles = result[:recommended_works].pluck(:title)
      expect(titles).not_to include('おすすめ作品')
    end

    it '同じタイトルの重複を除外する' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [mock_search_result, mock_search_result]
      )

      result = described_class.new(user, analysis_result).recommend
      titles = result[:recommended_works].pluck(:title)
      expect(titles.uniq.length).to eq(titles.length)
    end
  end
end
