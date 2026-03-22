# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'バリデーション' do
    let(:valid_attributes) do
      { username: 'testuser', email: 'test@example.com', password: 'password123' }
    end

    it '有効な属性でUserが作成できる' do
      user = described_class.new(valid_attributes)
      expect(user).to be_valid
    end

    it 'emailなしでバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(email: ''))
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it '不正な形式のemailでバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(email: 'invalid'))
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it '重複emailでバリデーションエラー' do
      described_class.create!(valid_attributes)
      duplicate = described_class.new(valid_attributes.merge(username: 'other'))
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to be_present
    end

    it 'passwordなしでバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(password: ''))
      expect(user).not_to be_valid
      expect(user.errors[:password]).to be_present
    end

    it 'passwordが短すぎるとバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(password: 'short'))
      expect(user).not_to be_valid
      expect(user.errors[:password]).to be_present
    end

    it 'usernameなしでバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(username: ''))
      expect(user).not_to be_valid
      expect(user.errors[:username]).to be_present
    end

    it '重複usernameでバリデーションエラー' do
      described_class.create!(valid_attributes)
      duplicate = described_class.new(valid_attributes.merge(email: 'other@example.com'))
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:username]).to be_present
    end

    it 'usernameが短すぎるとバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(username: 'a'))
      expect(user).not_to be_valid
      expect(user.errors[:username]).to be_present
    end

    it 'usernameが長すぎるとバリデーションエラー' do
      user = described_class.new(valid_attributes.merge(username: 'a' * 31))
      expect(user).not_to be_valid
      expect(user.errors[:username]).to be_present
    end
  end

  describe 'OAuth対応バリデーション' do
    it 'UserProviderがある場合はパスワードなしで有効' do
      user = described_class.new(username: 'oauthuser', email: 'oauth@example.com')
      user.save!(validate: false)
      UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      user.reload
      expect(user).to be_valid
    end

    it 'UserProviderがなくパスワードもない場合は無効' do
      user = described_class.new(username: 'nopassuser', email: 'nopass@example.com')
      expect(user).not_to be_valid
    end

    it 'メールアドレスが空でもUserProviderがあれば有効' do
      user = described_class.new(username: 'noemailuser', email: '')
      user.save!(validate: false)
      UserProvider.create!(user: user, provider: 'twitter2', provider_uid: '12345')
      user.reload
      expect(user).to be_valid
    end

    it 'メールアドレスが空でUserProviderもなければ無効' do
      user = described_class.new(username: 'noemailuser', email: '', password: 'password123')
      expect(user).not_to be_valid
    end
  end

  describe 'アソシエーション' do
    it 'user_providersを持つ' do
      user = described_class.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      expect(user).to respond_to(:user_providers)
    end

    it 'ユーザー削除時にuser_providersも削除される' do
      user = described_class.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      expect { user.destroy }.to change(UserProvider, :count).by(-1)
    end
  end
end
