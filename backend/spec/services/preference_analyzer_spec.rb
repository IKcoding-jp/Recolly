require 'rails_helper'

RSpec.describe PreferenceAnalyzer do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_record(attrs = {})
    work_attrs = {
      title: attrs.delete(:title) || "テスト作品#{rand(10_000)}",
      media_type: attrs.delete(:media_type) || 'anime',
      metadata: attrs.delete(:metadata) || { 'genres' => %w[Fantasy Drama] }
    }
    work = Work.create!(work_attrs)
    user.records.create!({ work: work, status: :completed, rating: 8 }.merge(attrs))
  end

  describe '#collect_data' do
    context '記録が複数ある場合' do
      before do
        create_record(title: '作品A', media_type: 'anime', rating: 9)
        create_record(title: '作品B', media_type: 'anime', rating: 8)
        create_record(title: '作品C', media_type: 'movie', rating: 7)
        create_record(title: '作品D', media_type: 'manga', rating: 9)
        create_record(title: '作品E', media_type: 'game', rating: 6)
      end

      it 'ジャンル別統計を返す' do
        data = described_class.new(user).collect_data
        anime_stat = data[:genre_stats].find { |s| s[:media_type] == 'anime' }
        expect(anime_stat[:count]).to eq(2)
        expect(anime_stat[:avg_rating]).to eq(8.5)
      end

      it '高評価作品TOP10を返す' do
        data = described_class.new(user).collect_data
        expect(data[:top_rated].first[:rating]).to eq(9)
      end

      it '高評価作品にジャンル情報を含む' do
        data = described_class.new(user).collect_data
        expect(data[:top_rated].first[:genres]).to eq(%w[Fantasy Drama])
      end
    end

    context '断念した作品がある場合' do
      it 'droppedに含まれる' do
        create_record(title: '断念作品', media_type: 'anime', rating: 3, status: :dropped)
        data = described_class.new(user).collect_data
        expect(data[:dropped].first[:title]).to eq('断念作品')
      end
    end

    context 'タグがある場合' do
      it 'タグ集計を含める' do
        record = create_record(title: '作品A', rating: 9)
        tag = user.tags.create!(name: '名作')
        record.record_tags.create!(tag: tag)

        data = described_class.new(user).collect_data
        expect(data[:tag_stats]).not_to be_empty
        expect(data[:tag_stats].first[:name]).to eq('名作')
        expect(data[:tag_stats].first[:count]).to eq(1)
      end
    end

    context '感想がある場合' do
      it '感想テキスト抜粋を含める' do
        record = create_record(title: '作品A', rating: 9)
        record.episode_reviews.create!(episode_number: 1, body: '伏線回収が見事だった')

        data = described_class.new(user).collect_data
        expect(data[:review_excerpts]).to include('伏線回収が見事だった')
      end
    end

    context 'タグも感想もない場合' do
      it 'tag_statsとreview_excerptsが空になる' do
        3.times { |i| create_record(title: "作品#{i}", rating: 7) }
        data = described_class.new(user).collect_data
        expect(data[:tag_stats]).to be_empty
        expect(data[:review_excerpts]).to be_empty
      end
    end

    context 'お気に入りがある場合' do
      it 'favoritesを含める' do
        record = create_record(title: 'お気に入り作品', rating: 10)
        FavoriteWork.create!(user: user, work: record.work, position: 1)

        data = described_class.new(user).collect_data
        expect(data[:favorites]).not_to be_empty
        expect(data[:favorites].first[:title]).to eq('お気に入り作品')
      end
    end
  end
end
