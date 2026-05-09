require 'rails_helper'

RSpec.describe MediaPreferencePromptBuilder do
  subject(:prompt) { described_class.new(data).build }

  let(:data) do
    {
      media_type: 'anime',
      record_count: 10,
      avg_rating: 8.2,
      top_rated: [
        { title: 'ヴァイオレット・エヴァーガーデン', rating: 9, genres: %w[Drama Fantasy] }
      ],
      dropped: [],
      tag_stats: [{ name: '泣ける', count: 5, avg_rating: 8.9 }],
      review_excerpts: ['伏線回収が見事'],
      favorites: []
    }
  end

  it 'メディア種別名が含まれること' do
    expect(prompt).to include('アニメ')
  end

  it '高評価作品のタイトルが含まれること' do
    expect(prompt).to include('ヴァイオレット・エヴァーガーデン')
  end

  it 'タグが含まれること' do
    expect(prompt).to include('泣ける')
  end

  it '感想テキストが含まれること' do
    expect(prompt).to include('伏線回収が見事')
  end

  it 'same_media_keywordsの出力フォーマットが含まれること' do
    expect(prompt).to include('same_media_keywords')
  end

  it 'cross_media_keywordsの出力フォーマットが含まれること' do
    expect(prompt).to include('cross_media_keywords')
  end

  context '断念作品がない場合' do
    it '断念セクションを含まないこと' do
      expect(prompt).not_to include('断念した作品')
    end
  end
end
