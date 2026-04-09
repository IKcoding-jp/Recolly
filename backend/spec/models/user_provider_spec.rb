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

  describe 'ロックアウト防御 (prevent_lockout_on_destroy)' do
    it 'password_set_at が nil かつ最後の user_provider の destroy は拒否される', :aggregate_failures do
      user = create_oauth_only_user(username: 'oauthonly', email: 'oauth@example.com')
      provider = user.user_providers.first
      result = provider.destroy
      expect(result).to be false
      expect(provider.errors[:base]).to include('最後のログイン手段は解除できません')
      expect(user.user_providers.count).to eq(1)
    end

    it 'password_set_at が present なら最後の user_provider でも destroy できる' do
      user = User.create!(username: 'withpw', email: 'withpw@example.com', password: 'password123')
      user.update_column(:password_set_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
      provider = described_class.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      expect(provider.destroy).to be_truthy
    end

    it '他の user_provider がまだ存在するなら destroy できる' do
      user = User.create!(username: 'multi', email: 'multi@example.com', password: 'password123')
      user.update_column(:password_set_at, nil) # rubocop:disable Rails/SkipsModelValidations
      p1 = described_class.create!(user: user, provider: 'google_oauth2', provider_uid: 'a')
      described_class.create!(user: user, provider: 'other_provider', provider_uid: 'b')
      expect { p1.destroy }.to change(described_class, :count).by(-1)
    end

    it 'User が destroy される連鎖削除では発動せず、user_providers も消える', :aggregate_failures do
      user = create_oauth_only_user(username: 'cascadeuser', email: 'cascade@example.com')
      expect { user.destroy }.to change(described_class, :count).by(-1)
                                                                .and change(User, :count).by(-1)
    end
  end
end
