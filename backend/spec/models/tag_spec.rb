# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Tag, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }

  describe 'バリデーション' do
    it '正常に作成できる' do
      tag = described_class.new(name: 'お気に入り', user: user)
      expect(tag).to be_valid
    end

    it 'nameが空の場合は無効' do
      tag = described_class.new(name: '', user: user)
      expect(tag).not_to be_valid
      expect(tag.errors[:name]).to be_present
    end

    it 'nameがnilの場合は無効' do
      tag = described_class.new(name: nil, user: user)
      expect(tag).not_to be_valid
      expect(tag.errors[:name]).to be_present
    end

    it 'name が30文字を超える場合は無効' do
      tag = described_class.new(name: 'a' * 31, user: user)
      expect(tag).not_to be_valid
      expect(tag.errors[:name]).to be_present
    end

    it 'name が30文字ちょうどの場合は有効' do
      tag = described_class.new(name: 'a' * 30, user: user)
      expect(tag).to be_valid
    end

    it '同一ユーザーで同名タグの重複は無効' do
      described_class.create!(name: 'お気に入り', user: user)
      duplicate = described_class.new(name: 'お気に入り', user: user)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to be_present
    end

    it '異なるユーザーで同名タグは有効' do
      described_class.create!(name: 'お気に入り', user: user)
      tag = described_class.new(name: 'お気に入り', user: other_user)
      expect(tag).to be_valid
    end
  end

  describe 'アソシエーション' do
    it 'userに属する' do
      tag = described_class.create!(name: 'お気に入り', user: user)
      expect(tag.user).to eq(user)
    end

    it 'record_tagsを持つ' do
      tag = described_class.create!(name: 'お気に入り', user: user)
      work = Work.create!(title: 'テスト作品', media_type: 'anime')
      record = Record.create!(user: user, work: work)
      RecordTag.create!(record: record, tag: tag)
      expect(tag.record_tags.count).to eq(1)
    end

    it 'タグ削除時にrecord_tagsも連鎖削除される' do
      tag = described_class.create!(name: 'お気に入り', user: user)
      work = Work.create!(title: 'テスト作品', media_type: 'anime')
      record = Record.create!(user: user, work: work)
      RecordTag.create!(record: record, tag: tag)
      expect { tag.destroy! }.to change(RecordTag, :count).by(-1)
    end
  end
end
