require 'rails_helper'

RSpec.describe WorkRecommender do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:keywords) do
    [
      { 'query' => '葬送のフリーレン', 'reason' => '作品Aに9点をつけたあなたへ。' },
      { 'query' => 'ぼっち・ざ・ろっく！', 'reason' => '日常系が好きなあなたへ。' }
    ]
  end

  def build_result(title:, external_api_id:, format: 'TV', source: 'anilist')
    Struct.new(:title, :media_type, :description, :cover_image_url,
               :external_api_id, :external_api_source, :metadata)
          .new(
            title: title,
            media_type: 'anime',
            description: 'テスト説明',
            cover_image_url: 'https://example.com/cover.jpg',
            external_api_id: external_api_id,
            external_api_source: source,
            metadata: { format: format, popularity: 0.5 }
          )
  end

  describe '#recommend' do
    it '提案キーワードごとに検索最上位を採用する' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.length).to eq(2)
      expect(results.first[:reason]).to include('9点')
      expect(results.first).to include(:title, :media_type, :description, :cover_url,
                                       :reason, :external_api_id, :external_api_source, :metadata)
    end

    it '最上位が既記録なら派生作品へ繰り下げず提案自体をスキップする' do # rubocop:disable RSpec/ExampleLength
      work = Work.create!(title: '葬送のフリーレン', media_type: 'anime',
                          external_api_id: '1', external_api_source: 'anilist')
      user.records.create!(work: work, status: :completed)

      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1'),
         build_result(title: '葬送のフリーレン 特別篇', external_api_id: '99')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      titles = results.pluck(:title)
      expect(titles).not_to include('葬送のフリーレン 特別篇')
      expect(titles).to include('ぼっち・ざ・ろっく！')
    end

    it 'SPECIAL/OVA/MUSIC/TV_SHORTのAniList作品を採用しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン 特別篇', external_api_id: '99', format: 'SPECIAL'),
         build_result(title: '葬送のフリーレン', external_api_id: '1', format: 'TV')],
        []
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.pluck(:title)).to eq(['葬送のフリーレン'])
    end

    it 'AniList以外のソースはformatフィルタの対象外' do
      tmdb_result = build_result(title: '君の名前で僕を呼んで', external_api_id: '5', source: 'tmdb')

      allow_any_instance_of(WorkSearchService).to receive(:search).and_return([tmdb_result], []) # rubocop:disable RSpec/AnyInstance

      results = described_class.new(user).recommend('movie', keywords)
      expect(results.pluck(:title)).to include('君の名前で僕を呼んで')
    end

    it 'max_countに達したら残りの提案を処理しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords, max_count: 1)
      expect(results.length).to eq(1)
    end

    it '同じタイトルの重複を採用しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '同じ作品', external_api_id: '1')],
        [build_result(title: '同じ作品', external_api_id: '1')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.length).to eq(1)
    end

    it '検索結果が空の提案はスキップする' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.pluck(:title)).to eq(['ぼっち・ざ・ろっく！'])
    end
  end
end
