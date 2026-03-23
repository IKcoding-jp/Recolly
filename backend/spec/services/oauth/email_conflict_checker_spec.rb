# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Oauth::EmailConflictChecker do
  describe '#check' do
    it 'メールアドレスがnilなら衝突なし' do
      result = described_class.new(email: nil, provider: 'google_oauth2').check
      expect(result).to be_nil
    end

    it 'メールアドレスが空文字なら衝突なし' do
      result = described_class.new(email: '', provider: 'google_oauth2').check
      expect(result).to be_nil
    end

    it '同じメールのユーザーがいなければ衝突なし' do
      result = described_class.new(email: 'new@example.com', provider: 'google_oauth2').check
      expect(result).to be_nil
    end

    it '同じメール+同じプロバイダのUserProviderがあれば衝突なし（既存ユーザーログイン）' do
      user = User.create!(username: 'existing', email: 'existing@example.com', password: 'password123')
      UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      result = described_class.new(email: 'existing@example.com', provider: 'google_oauth2').check
      expect(result).to be_nil
    end

    it 'メール登録済みユーザーで別プロバイダなら衝突エラー' do
      User.create!(username: 'existing', email: 'existing@example.com', password: 'password123')
      result = described_class.new(email: 'existing@example.com', provider: 'google_oauth2').check
      expect(result[:code]).to eq('email_already_registered')
      expect(result[:message]).to include('メールアドレスでログイン')
    end

    it '別のOAuthで登録済みならプロバイダ名付きエラー' do
      user = User.create!(username: 'existing', email: 'existing@example.com', password: 'password123')
      UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      result = described_class.new(email: 'existing@example.com', provider: 'twitter2').check
      expect(result[:code]).to eq('email_registered_with_other_provider')
      expect(result[:message]).to include('Google')
    end
  end
end
