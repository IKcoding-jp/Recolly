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
end
