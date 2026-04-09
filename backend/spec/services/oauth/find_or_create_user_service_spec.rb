# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Oauth::FindOrCreateUserService do
  let(:google_args) do
    {
      provider: 'google_oauth2',
      uid: 'google_12345',
      email: 'user@gmail.com',
      name: 'Test User'
    }
  end

  describe '#call' do
    context '既存ユーザー（UserProvider一致）' do
      it '既存ユーザーを返す' do
        user = User.create!(username: 'existing', email: 'user@gmail.com', password: 'password123')
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: 'google_12345')
        result = described_class.new(**google_args).call
        expect(result[:status]).to eq(:existing_user)
        expect(result[:user]).to eq(user)
      end
    end

    context 'メール衝突' do
      it 'エラーを返す' do
        User.create!(username: 'existing', email: 'user@gmail.com', password: 'password123')
        result = described_class.new(**google_args).call
        expect(result[:status]).to eq(:conflict)
        expect(result[:error][:code]).to eq('email_already_registered')
      end
    end

    context '新規ユーザー（メールあり）' do
      it 'new_userステータスとOAuthデータを返す' do
        result = described_class.new(**google_args).call
        expect(result[:status]).to eq(:new_user)
        expect(result[:oauth_data][:provider]).to eq('google_oauth2')
        expect(result[:oauth_data][:email]).to eq('user@gmail.com')
      end
    end

    context '新規ユーザー（メールなし）' do
      it 'new_userステータスを返す（メールなし）' do
        result = described_class.new(
          provider: 'google_oauth2',
          uid: 'google_no_email',
          email: nil,
          name: 'NoEmailUser'
        ).call
        expect(result[:status]).to eq(:new_user)
        expect(result[:oauth_data][:email]).to be_nil
      end
    end
  end
end
