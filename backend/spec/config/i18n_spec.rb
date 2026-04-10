# frozen_string_literal: true

require 'rails_helper'

RSpec.describe I18n do
  describe 'default_locale' do
    it 'デフォルトロケールが:jaであること' do
      expect(described_class.default_locale).to eq(:ja)
    end
  end
end
