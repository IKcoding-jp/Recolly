# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SearchRelevanceScorer do
  describe '.tier' do
    it '完全一致でTIER_EXACT(3)を返す' do
      expect(described_class.tier('ゼルダ', 'ゼルダ')).to eq(described_class::TIER_EXACT)
    end

    it '前方一致でTIER_PREFIX(2)を返す' do
      expect(described_class.tier('ゼルダ', 'ゼルダの伝説')).to eq(described_class::TIER_PREFIX)
    end

    it '部分一致（先頭以外に含む）でTIER_PARTIAL(1)を返す' do
      expect(described_class.tier('ゼルダ', 'リンクの冒険 ゼルダの伝説2')).to eq(described_class::TIER_PARTIAL)
    end

    it '不一致でTIER_NONE(0)を返す' do
      expect(described_class.tier('ゼルダ', 'マリオカート')).to eq(described_class::TIER_NONE)
    end

    it '全角/半角・大文字/小文字の表記揺れを吸収して一致させる' do
      expect(described_class.tier('ＦＩＮＡＬ　ＦＡＮＴＡＳＹ', 'Final Fantasy')).to eq(described_class::TIER_EXACT)
    end

    it 'クエリが空文字ならTIER_NONEを返す' do
      expect(described_class.tier('', 'ゼルダ')).to eq(described_class::TIER_NONE)
    end

    it 'タイトルがnilならTIER_NONEを返す' do
      expect(described_class.tier('ゼルダ', nil)).to eq(described_class::TIER_NONE)
    end

    it '不正なUTF-8バイト列でも例外を投げずTIER_NONEを返す' do
      invalid = (+"\xff\xfe").force_encoding('UTF-8')
      expect(described_class.tier('ゼルダ', invalid)).to eq(described_class::TIER_NONE)
    end
  end
end
