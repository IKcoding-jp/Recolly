require 'rails_helper'

RSpec.describe MediaPreferenceAnalyzer do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_anime_records(count)
    count.times do |i|
      work = Work.create!(title: "アニメ#{i}", media_type: :anime)
      user.records.create!(work: work, status: :completed, rating: 8)
    end
  end

  describe '#analyze_and_save' do
    context '記録が3件未満の場合' do
      before { create_anime_records(2) }

      it 'nilを返してDBに保存しないこと' do
        result = described_class.new(user, 'anime').analyze_and_save
        expect(result).to be_nil
        expect(MediaPreferenceProfile.count).to eq(0)
      end
    end

    context '記録が3件以上の場合' do
      around do |example|
        original = ENV.fetch('ANTHROPIC_API_KEY', nil)
        ENV['ANTHROPIC_API_KEY'] = 'test-api-key'
        example.run
      ensure
        ENV['ANTHROPIC_API_KEY'] = original
      end

      let(:mock_response_json) do
        {
          'summary' => 'アニメの好み傾向テキスト',
          'preference_scores' => [{ 'label' => '感情的な深さ', 'score' => 9.1 }],
          'same_media_keywords' => [{ 'query' => '葬送のフリーレン', 'reason' => 'テスト理由' }],
          'cross_media_keywords' => [{ 'media_type' => 'manga', 'query' => 'ナウシカ', 'reason' => 'クロス理由' }]
        }
      end

      let(:mock_search_result) do
        double('work', # rubocop:disable RSpec/VerifiedDoubles
               title: '葬送のフリーレン',
               media_type: 'anime',
               description: 'テスト説明',
               cover_image_url: nil,
               external_api_id: '154587',
               external_api_source: 'anilist',
               metadata: {})
      end

      before do
        create_anime_records(5)

        text_block = double('TextBlock', text: mock_response_json.to_json) # rubocop:disable RSpec/VerifiedDoubles
        message = double('Message', content: [text_block]) # rubocop:disable RSpec/VerifiedDoubles
        messages_resource = double('Messages') # rubocop:disable RSpec/VerifiedDoubles
        client_double = double('Anthropic::Client', messages: messages_resource) # rubocop:disable RSpec/VerifiedDoubles
        allow(Anthropic::Client).to receive(:new).and_return(client_double)
        allow(messages_resource).to receive(:create).and_return(message)

        search_service = double('WorkSearchService') # rubocop:disable RSpec/VerifiedDoubles
        allow(WorkSearchService).to receive(:new).and_return(search_service)
        allow(search_service).to receive(:search).and_return([mock_search_result])
      end

      it 'MediaPreferenceProfileをDBに保存すること' do
        described_class.new(user, 'anime').analyze_and_save
        profile = MediaPreferenceProfile.find_by(user: user, media_type: :anime)
        expect(profile).not_to be_nil
        expect(profile.analysis_summary).to eq('アニメの好み傾向テキスト')
        expect(profile.preference_scores).to eq([{ 'label' => '感情的な深さ', 'score' => 9.1 }])
      end

      it 'same_media_worksに作品が保存されること' do
        described_class.new(user, 'anime').analyze_and_save
        profile = MediaPreferenceProfile.find_by(user: user, media_type: :anime)
        expect(profile.same_media_works).not_to be_empty
        expect(profile.same_media_works.first['title']).to eq('葬送のフリーレン')
      end

      it '再実行時は既存レコードを上書きすること' do
        described_class.new(user, 'anime').analyze_and_save
        described_class.new(user, 'anime').analyze_and_save
        expect(MediaPreferenceProfile.where(user: user, media_type: :anime).count).to eq(1)
      end
    end
  end
end
