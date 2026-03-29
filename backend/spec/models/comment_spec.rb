# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Comment, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
  let(:discussion) { Discussion.create!(title: 'テストスレッド', body: 'テスト本文', user: user, work: work) }

  before do
    Record.create!(user: user, work: work, status: :watching)
  end

  describe 'バリデーション' do
    it 'bodyがあれば有効' do
      comment = described_class.new(body: 'テストコメント', user: user, discussion: discussion)
      expect(comment).to be_valid
    end

    it 'bodyが空なら無効' do
      comment = described_class.new(body: '', user: user, discussion: discussion)
      expect(comment).not_to be_valid
    end

    it 'bodyが3000文字を超えると無効' do
      comment = described_class.new(body: 'a' * 3001, user: user, discussion: discussion)
      expect(comment).not_to be_valid
    end
  end

  describe 'カウンターキャッシュ' do
    it 'コメント作成時にdiscussionのcomments_countが増加する' do
      expect do
        described_class.create!(body: 'テスト', user: user, discussion: discussion)
      end.to change { discussion.reload.comments_count }.by(1)
    end

    it 'コメント削除時にdiscussionのcomments_countが減少する' do
      comment = described_class.create!(body: 'テスト', user: user, discussion: discussion)
      expect do
        comment.destroy!
      end.to change { discussion.reload.comments_count }.by(-1)
    end
  end

  describe 'リレーション' do
    it 'discussionに属する' do
      association = described_class.reflect_on_association(:discussion)
      expect(association.macro).to eq(:belongs_to)
    end

    it 'userに属する' do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq(:belongs_to)
    end
  end
end
