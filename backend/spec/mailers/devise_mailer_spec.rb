# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DeviseMailer, type: :mailer do
  describe '#reset_password_instructions' do
    subject(:mail) { described_class.reset_password_instructions(user, token) }

    let(:user) do
      User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
    end
    let(:token) { 'dummy-reset-token-abcdef' }

    # FRONTEND_URL を明示的にセットして URL の組み立てを検証する
    around do |example|
      original = ENV.fetch('FRONTEND_URL', nil)
      ENV['FRONTEND_URL'] = 'https://recolly.net'
      example.run
      ENV['FRONTEND_URL'] = original
    end

    it '送信元が noreply@recolly.net' do
      expect(mail.from).to eq(['noreply@recolly.net'])
    end

    it '件名が日本語' do
      expect(mail.subject).to eq('【Recolly】パスワードリセットのご案内')
    end

    it 'HTML パートと text パートの両方を含む multipart メール' do
      expect(mail).to be_multipart
      expect(mail.html_part).to be_present
      expect(mail.text_part).to be_present
    end

    it 'HTML 本文にユーザー名を含む' do
      expect(mail.html_part.body.encoded).to include('testuser')
    end

    it 'HTML 本文にフロントエンド URL のリセットリンクを含む' do
      expect(mail.html_part.body.encoded)
        .to include("https://recolly.net/password/edit?reset_password_token=#{token}")
    end

    it 'text 本文にフロントエンド URL のリセットリンクを含む' do
      expect(mail.text_part.body.encoded)
        .to include("https://recolly.net/password/edit?reset_password_token=#{token}")
    end

    it 'FRONTEND_URL が未設定のときは localhost:5173 にフォールバックする' do
      ENV['FRONTEND_URL'] = nil
      expect(mail.html_part.body.encoded)
        .to include("http://localhost:5173/password/edit?reset_password_token=#{token}")
    end
  end
end
