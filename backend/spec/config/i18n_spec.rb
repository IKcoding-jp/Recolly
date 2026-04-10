# frozen_string_literal: true

require 'rails_helper'

RSpec.describe I18n do
  describe 'default_locale' do
    it 'デフォルトロケールが:jaであること' do
      expect(described_class.default_locale).to eq(:ja)
    end
  end

  describe 'Rails標準バリデーションメッセージ' do
    it '主要なバリデーションキーが翻訳されていること' do
      keys = %i[blank taken invalid too_short too_long confirmation
                not_a_number greater_than less_than_or_equal_to
                greater_than_or_equal_to]
      keys.each do |key|
        translation = described_class.t("errors.messages.#{key}", count: 1, attribute: 'テスト')
        expect(translation).not_to include('translation missing'),
                                   "errors.messages.#{key} が未翻訳です"
      end
    end

    it 'Userモデルの属性名が翻訳されていること' do
      %i[email password username].each do |attr|
        name = User.human_attribute_name(attr)
        expect(name).not_to eq(attr.to_s),
                            "User.#{attr} の属性名が未翻訳です"
      end
    end
  end

  describe 'Deviseメッセージ' do
    # devise.en.yml に存在する主要キーを網羅的にチェック
    let(:devise_required_keys) do
      %w[
        devise.confirmations.confirmed
        devise.confirmations.send_instructions
        devise.failure.already_authenticated
        devise.failure.invalid
        devise.failure.unauthenticated
        devise.sessions.signed_in
        devise.sessions.signed_out
        devise.registrations.signed_up
        devise.registrations.updated
        devise.passwords.send_instructions
        devise.passwords.updated
        devise.mailer.reset_password_instructions.subject
        devise.mailer.confirmation_instructions.subject
        devise.mailer.email_changed.subject
        devise.mailer.password_change.subject
        devise.omniauth_callbacks.success
        devise.unlocks.unlocked
      ]
    end

    it 'Deviseの主要キーが全て翻訳されていること' do
      devise_required_keys.each do |key|
        translation = described_class.t(key, authentication_keys: 'テスト', kind: 'テスト',
                                             reason: 'テスト', default: nil)
        expect(translation).to be_present, "#{key} が未翻訳です"
      end
    end

    it 'Deviseの認証失敗メッセージが日本語であること' do
      msg = described_class.t('devise.failure.invalid', authentication_keys: 'メールアドレス')
      expect(msg).not_to include('Invalid')
      expect(msg).to include('メールアドレス')
    end

    it 'Deviseのメール件名が日本語であること' do
      subject_text = described_class.t('devise.mailer.reset_password_instructions.subject')
      expect(subject_text).not_to include('Reset')
    end
  end
end
