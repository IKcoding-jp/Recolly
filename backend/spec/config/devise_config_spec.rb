# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Devise do
  describe '.mailer_sender' do
    # 回帰防止: 本番ドメイン recolly.net を使うこと。
    # 過去に recolly.com と誤記されていて SES 検証ドメインと不一致になるバグがあった。
    it 'is noreply@recolly.net' do
      expect(described_class.mailer_sender).to eq('noreply@recolly.net')
    end
  end
end
