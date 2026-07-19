require 'rails_helper'

RSpec.describe PreferencePromptBuilder do
  let(:data) do
    {
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.5 }],
      top_rated: [{ title: '葬送のフリーレン', media_type: 'anime', rating: 9, genres: ['Fantasy'] }],
      dropped: [],
      tag_stats: [],
      review_excerpts: [],
      favorites: [],
      recorded_titles: ['葬送のフリーレン (anime)', 'STEINS;GATE (anime)']
    }
  end

  describe '#build' do
    it '全6メディアの出力指示を含む' do
      prompt = described_class.new(data).build
      %w[anime movie drama book manga game].each do |media_type|
        expect(prompt).to include(%("#{media_type}":))
      end
    end

    it '記録済みタイトル一覧と派生作品の除外指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('記録済みの全作品')
      expect(prompt).to include('STEINS;GATE (anime)')
      expect(prompt).to include('派生作品')
    end

    it '各メディア8件の提案指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include("#{described_class::PROPOSALS_PER_MEDIA}件")
    end

    it '記録が無いメディアも推定して提案する指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('記録が無いメディア')
    end

    it 'trendとworksの出力形式を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('"trend"')
      expect(prompt).to include('"media_recommendations"')
    end

    it '記録済みタイトルが空でもエラーにならない' do
      prompt = described_class.new(data.merge(recorded_titles: [])).build
      expect(prompt).not_to include('記録済みの全作品')
    end
  end
end
