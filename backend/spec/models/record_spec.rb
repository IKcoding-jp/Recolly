# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Record, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: '進撃の巨人', media_type: 'anime') }

  describe 'バリデーション' do
    it 'user_id + work_id で記録作成できる' do
      record = described_class.new(user: user, work: work)
      expect(record).to be_valid
    end

    it 'statusのデフォルト値が plan_to_watch' do
      record = described_class.create!(user: user, work: work)
      expect(record.status).to eq('plan_to_watch')
    end

    it '同じ user + work の重複を拒否' do
      described_class.create!(user: user, work: work)
      duplicate = described_class.new(user: user, work: work)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:work_id]).to be_present
    end

    it 'rating は 1〜10 の範囲' do
      record = described_class.new(user: user, work: work, rating: 11)
      expect(record).not_to be_valid
    end

    it 'rating が 10 で有効' do
      record = described_class.new(user: user, work: work, rating: 10)
      expect(record).to be_valid
    end

    it 'rating が 0 で無効' do
      record = described_class.new(user: user, work: work, rating: 0)
      expect(record).not_to be_valid
    end

    it 'rating が nil でも有効（未評価）' do
      record = described_class.new(user: user, work: work, rating: nil)
      expect(record).to be_valid
    end

    describe 'current_episode のバリデーション' do
      let(:work_with_episodes) { Work.create!(title: '進撃の巨人Final', media_type: 'anime', total_episodes: 75) }

      it 'current_episode が total_episodes を超えると無効' do
        record = described_class.new(user: user, work: work_with_episodes, current_episode: 76)
        expect(record).not_to be_valid
        expect(record.errors[:current_episode]).to be_present
      end

      it 'current_episode が total_episodes と同値なら有効' do
        record = described_class.new(user: user, work: work_with_episodes, current_episode: 75)
        expect(record).to be_valid
      end

      it 'total_episodes が nil の作品では上限チェックをスキップ' do
        work_no_episodes = Work.create!(title: '映画B', media_type: 'movie')
        record = described_class.new(user: user, work: work_no_episodes, current_episode: 999)
        expect(record).to be_valid
      end

      it 'current_episode が負の値で無効' do
        record = described_class.new(user: user, work: work_with_episodes, current_episode: -1)
        expect(record).not_to be_valid
      end
    end
  end

  describe 'enum' do
    it 'status の全値が定義されている' do
      expected = %w[watching completed on_hold dropped plan_to_watch]
      expect(described_class.statuses.keys).to match_array(expected)
    end
  end

  describe '自動処理コールバック' do
    let(:work_with_episodes) { Work.create!(title: '進撃の巨人Final', media_type: 'anime', total_episodes: 75) }

    describe 'status → watching' do
      it 'started_at が未設定なら今日をセット' do
        record = described_class.create!(user: user, work: work_with_episodes, status: :watching)
        expect(record.started_at).to eq(Date.current)
      end

      it 'started_at が設定済みなら変更しない' do
        past_date = Date.new(2026, 1, 1)
        record = described_class.create!(user: user, work: work_with_episodes, status: :watching, started_at: past_date)
        expect(record.started_at).to eq(past_date)
      end
    end

    describe 'status → completed' do
      it 'completed_at を今日にセット' do
        record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
        expect(record.completed_at).to eq(Date.current)
      end

      it 'current_episode を total_episodes に揃える' do
        record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
        expect(record.current_episode).to eq(75)
      end

      it 'total_episodes が nil の作品では current_episode を変更しない' do
        work_no_episodes = Work.create!(title: '映画A', media_type: 'movie')
        record = described_class.create!(user: user, work: work_no_episodes, status: :completed, current_episode: 0)
        expect(record.current_episode).to eq(0)
      end

      it '新規記録を completed で作成すると started_at も今日にセット' do
        record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
        expect(record.started_at).to eq(Date.current)
        expect(record.completed_at).to eq(Date.current)
      end
    end

    describe 'status → plan_to_watch' do
      it 'started_at, completed_at をクリアし current_episode を 0 に、rating を nil にリセット' do
        record = described_class.create!(user: user, work: work_with_episodes,
                                         status: :watching, rating: 8, current_episode: 30)
        record.update!(status: :plan_to_watch)
        expect(record.started_at).to be_nil
        expect(record.completed_at).to be_nil
        expect(record.current_episode).to eq(0)
        expect(record.rating).to be_nil
      end
    end

    describe 'current_episode が total_episodes に到達' do
      it 'status を completed に自動変更' do
        record = described_class.create!(user: user, work: work_with_episodes,
                                         status: :watching, current_episode: 74)
        record.update!(current_episode: 75)
        expect(record.status).to eq('completed')
        expect(record.completed_at).to eq(Date.current)
      end
    end

    describe 'started_at と completed_at の整合性' do
      it 'started_at が completed_at より後なら無効' do
        record = described_class.new(user: user, work: work,
                                     started_at: Date.new(2026, 3, 20),
                                     completed_at: Date.new(2026, 3, 10))
        expect(record).not_to be_valid
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

    it 'has_many :episode_reviews' do
      expect(described_class.reflect_on_association(:episode_reviews).macro).to eq(:has_many)
    end
  end

  describe 'review_text' do
    let(:record) { described_class.create!(user: user, work: work) }

    it 'review_textを保存できる' do
      record.update(review_text: '素晴らしい作品だった')
      expect(record.reload.review_text).to eq('素晴らしい作品だった')
    end

    it '10,000文字を超えるreview_textは無効' do
      record.review_text = 'あ' * 10_001
      expect(record).not_to be_valid
      expect(record.errors[:review_text]).to be_present
    end

    it '10,000文字ちょうどのreview_textは有効' do
      record.review_text = 'あ' * 10_000
      expect(record).to be_valid
    end
  end

  describe 'visibility' do
    let(:record) { described_class.create!(user: user, work: work) }

    it 'デフォルトでprivate_recordになる' do
      expect(record.visibility).to eq('private_record')
    end

    it 'public_recordに変更できる' do
      record.update(visibility: :public_record)
      expect(record.reload.visibility).to eq('public_record')
    end
  end
end
