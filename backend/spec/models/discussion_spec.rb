# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Discussion, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime, total_episodes: 12) }

  # ディスカッション作成にはRecordが必要（作品を記録済みのユーザーのみ投稿可能）
  before { Record.create!(user: user, work: work, status: :watching) }

  describe 'バリデーション' do
    describe 'title' do
      it '必須項目' do
        discussion = described_class.new(user: user, work: work, title: nil, body: 'テスト本文')
        expect(discussion).not_to be_valid
        expect(discussion.errors[:title]).to be_present
      end

      it '100文字以内なら有効' do
        discussion = described_class.new(user: user, work: work, title: 'あ' * 100, body: 'テスト本文')
        expect(discussion).to be_valid
      end

      it '101文字以上は無効' do
        discussion = described_class.new(user: user, work: work, title: 'あ' * 101, body: 'テスト本文')
        expect(discussion).not_to be_valid
        expect(discussion.errors[:title]).to be_present
      end
    end

    describe 'body' do
      it '必須項目' do
        discussion = described_class.new(user: user, work: work, title: 'テストタイトル', body: nil)
        expect(discussion).not_to be_valid
        expect(discussion.errors[:body]).to be_present
      end

      it '5000文字以内なら有効' do
        discussion = described_class.new(user: user, work: work, title: 'テストタイトル', body: 'あ' * 5000)
        expect(discussion).to be_valid
      end

      it '5001文字以上は無効' do
        discussion = described_class.new(user: user, work: work, title: 'テストタイトル', body: 'あ' * 5001)
        expect(discussion).not_to be_valid
        expect(discussion.errors[:body]).to be_present
      end
    end

    describe 'episode_number' do
      it 'nilでも有効（話数指定なし）' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: nil)
        expect(discussion).to be_valid
      end

      it '正の整数なら有効' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: 5)
        expect(discussion).to be_valid
      end

      it '0は無効' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: 0)
        expect(discussion).not_to be_valid
        expect(discussion.errors[:episode_number]).to be_present
      end

      it '負の値は無効' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: -1)
        expect(discussion).not_to be_valid
        expect(discussion.errors[:episode_number]).to be_present
      end

      it 'total_episodes以下なら有効' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: 12)
        expect(discussion).to be_valid
      end

      it 'total_episodesを超えると無効' do
        discussion = described_class.new(user: user, work: work, title: 'テスト', body: 'テスト', episode_number: 13)
        expect(discussion).not_to be_valid
        expect(discussion.errors[:episode_number]).to be_present
      end

      it 'total_episodesがnilの作品では正の整数ならどんな値でも有効' do
        work_no_episodes = Work.create!(title: '映画A', media_type: :movie)
        Record.create!(user: user, work: work_no_episodes, status: :watching)
        discussion = described_class.new(user: user, work: work_no_episodes, title: 'テスト', body: 'テスト',
                                         episode_number: 999)
        expect(discussion).to be_valid
      end
    end

    describe 'has_spoiler' do
      it 'デフォルトはfalse' do
        discussion = described_class.create!(user: user, work: work, title: 'テスト', body: 'テスト')
        expect(discussion.has_spoiler).to be(false)
      end
    end
  end

  describe 'リレーション' do
    it 'user に属する' do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq(:belongs_to)
    end

    it 'work に属する' do
      association = described_class.reflect_on_association(:work)
      expect(association.macro).to eq(:belongs_to)
    end

    it 'has_many :comments' do
      association = described_class.reflect_on_association(:comments)
      expect(association.macro).to eq(:has_many)
    end
  end
end
