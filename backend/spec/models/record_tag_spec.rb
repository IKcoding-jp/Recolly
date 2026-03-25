# frozen_string_literal: true

require 'rails_helper'

RSpec.describe RecordTag, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: 'anime') }
  let(:record) { Record.create!(user: user, work: work) }
  let(:tag) { Tag.create!(name: 'お気に入り', user: user) }

  describe 'バリデーション' do
    it '正常に作成できる' do
      record_tag = described_class.new(record: record, tag: tag)
      expect(record_tag).to be_valid
    end

    it '同一record+tagの重複は無効' do
      described_class.create!(record: record, tag: tag)
      duplicate = described_class.new(record: record, tag: tag)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:tag_id]).to be_present
    end
  end
end
