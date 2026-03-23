# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserProvider, type: :model do
  describe 'バリデーション' do
    it 'provider, provider_uid, user_idが全て揃っていれば有効' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      provider = described_class.new(user: user, provider: 'google_oauth2', provider_uid: '12345')
      expect(provider).to be_valid
    end

    it 'providerが空なら無効' do
      provider = described_class.new(provider: nil, provider_uid: '12345')
      expect(provider).not_to be_valid
    end

    it 'provider_uidが空なら無効' do
      provider = described_class.new(provider: 'google_oauth2', provider_uid: nil)
      expect(provider).not_to be_valid
    end
  end

  describe 'ユニーク制約' do
    it '同一プロバイダ+UIDの重複を許可しない' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      described_class.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      user2 = User.create!(username: 'testuser2', email: 'test2@example.com', password: 'password123')
      duplicate = described_class.new(user: user2, provider: 'google_oauth2', provider_uid: '12345')
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it '同一ユーザーで同一プロバイダの重複を許可しない' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      described_class.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      duplicate = described_class.new(user: user, provider: 'google_oauth2', provider_uid: '67890')
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it '同一ユーザーで異なるプロバイダは許可' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      described_class.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      different = described_class.new(user: user, provider: 'other_provider', provider_uid: '67890')
      expect(different).to be_valid
    end
  end
end
