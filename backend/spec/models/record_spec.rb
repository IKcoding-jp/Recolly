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

    it 'rating は 1〜5 の範囲' do
      record = described_class.new(user: user, work: work, rating: 6)
      expect(record).not_to be_valid
    end

    it 'rating が nil でも有効（未評価）' do
      record = described_class.new(user: user, work: work, rating: nil)
      expect(record).to be_valid
    end
  end

  describe 'enum' do
    it 'status の全値が定義されている' do
      expected = %w[watching completed on_hold dropped plan_to_watch]
      expect(described_class.statuses.keys).to match_array(expected)
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
  end
end
