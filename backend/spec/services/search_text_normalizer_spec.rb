# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SearchTextNormalizer do
  describe '.normalize' do
    it '前後の空白を除去する' do
      expect(described_class.normalize('  進撃の巨人  ')).to eq('進撃の巨人')
    end

    it '全角英数を半角に、大文字を小文字に変換する（NFKC＋downcase）' do
      expect(described_class.normalize('ＦＡＴＥ Stay Night')).to eq('fate stay night')
    end

    it '連続する空白・全角空白を半角空白1個に圧縮する' do
      expect(described_class.normalize('進撃の巨人　 Season　2')).to eq('進撃の巨人 season 2')
    end

    it 'nil は空文字を返す' do
      expect(described_class.normalize(nil)).to eq('')
    end
  end
end
