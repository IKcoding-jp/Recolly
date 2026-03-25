# frozen_string_literal: true

require 'rails_helper'

RSpec.describe EpisodeReview, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime, total_episodes: 24) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }

  describe 'バリデーション' do
    it '有効なepisode_reviewを作成できる' do
      review = described_class.new(record: record, episode_number: 1, body: '面白かった')
      expect(review).to be_valid
    end

    it 'bodyが必須' do
      review = described_class.new(record: record, episode_number: 1, body: nil)
      expect(review).not_to be_valid
    end

    it 'bodyが空文字は無効' do
      review = described_class.new(record: record, episode_number: 1, body: '')
      expect(review).not_to be_valid
    end

    it 'bodyが10,000文字を超えると無効' do
      review = described_class.new(record: record, episode_number: 1, body: 'あ' * 10_001)
      expect(review).not_to be_valid
    end

    it 'episode_numberが必須' do
      review = described_class.new(record: record, episode_number: nil, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'episode_numberが0以下は無効' do
      review = described_class.new(record: record, episode_number: 0, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'episode_numberがtotal_episodesを超えると無効' do
      review = described_class.new(record: record, episode_number: 25, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'total_episodesが未設定の場合はepisode_numberの上限チェックなし' do
      work_no_total = Work.create!(title: '話数未定', media_type: :anime)
      record2 = Record.create!(user: user, work: work_no_total, status: :watching)
      review = described_class.new(record: record2, episode_number: 999, body: '面白い')
      expect(review).to be_valid
    end

    it '同じrecordの同じepisode_numberで重複作成は無効' do
      described_class.create!(record: record, episode_number: 1, body: '初回')
      duplicate = described_class.new(record: record, episode_number: 1, body: '2回目')
      expect(duplicate).not_to be_valid
    end
  end

  describe 'リレーション' do
    it 'recordに属する' do
      expect(described_class.reflect_on_association(:record).macro).to eq(:belongs_to)
    end
  end

  describe 'デフォルト値' do
    it 'visibilityはデフォルトでprivate_record' do
      review = described_class.create!(record: record, episode_number: 1, body: '面白い')
      expect(review.visibility).to eq('private_record')
    end
  end
end
