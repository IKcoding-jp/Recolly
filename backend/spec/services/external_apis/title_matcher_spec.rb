# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ExternalApis::TitleMatcher, type: :service do
  describe '.title_match?' do
    context 'クエリと候補が完全一致する場合' do
      it 'true を返す' do
        expect(described_class.title_match?('呪術廻戦', '呪術廻戦')).to be true
      end
    end

    context '全角/半角の表記揺れがある場合' do
      it 'NFKC 正規化で全角!と半角!を同一視する' do
        expect(described_class.title_match?('けいおん！', 'けいおん!')).to be true
      end

      it '全角英数字と半角英数字を同一視する' do
        expect(described_class.title_match?('ＡＫＩＲＡ', 'AKIRA')).to be true
      end
    end

    context '大小文字の差がある場合' do
      it 'downcase で同一視する' do
        expect(described_class.title_match?('Attack on Titan', 'ATTACK ON TITAN')).to be true
      end
    end

    context '空白の有無が異なる場合' do
      it '空白を除去して比較する' do
        expect(described_class.title_match?('Attack on Titan', 'AttackonTitan')).to be true
      end
    end

    context 'クエリにシリーズ識別子が付き、候補が親作品の場合' do
      it 'クエリが候補の1.5倍以上長く含む場合は false（親作品却下）' do
        # '進撃の巨人 Season 2' (12) vs '進撃の巨人' (5) → 1.5倍以上 + 含む
        expect(described_class.title_match?('進撃の巨人 Season 2', '進撃の巨人')).to be false
      end

      it 'OVA サフィックスでも親作品を弾く' do
        expect(described_class.title_match?('進撃の巨人 OVA', '進撃の巨人')).to be false
      end

      it '第2期 サフィックスでも親作品を弾く' do
        expect(described_class.title_match?('呪術廻戦 第2期', '呪術廻戦')).to be false
      end

      it '完結編 サブタイトルでも親作品を弾く' do
        expect(described_class.title_match?('進撃の巨人 完結編 前編', '進撃の巨人')).to be false
      end
    end

    context '逆方向（候補がクエリの1.5倍以上長く含む場合）' do
      it 'false を返す' do
        expect(described_class.title_match?('進撃の巨人', '進撃の巨人 Season 2')).to be false
      end
    end

    context '部分一致（軽微な表記揺れ）の場合' do
      it '長さ比が1.5倍未満で部分一致するなら true' do
        # 表記揺れ例: 短い差分（記号など）を許容したい
        expect(described_class.title_match?('ABCDE', 'ABCDEF')).to be true
      end
    end

    context 'クエリまたは候補が空の場合' do
      it 'クエリが nil なら false' do
        expect(described_class.title_match?(nil, '進撃の巨人')).to be false
      end

      it 'クエリが空文字なら false' do
        expect(described_class.title_match?('', '進撃の巨人')).to be false
      end

      it '候補が nil なら false' do
        expect(described_class.title_match?('進撃の巨人', nil)).to be false
      end
    end
  end

  describe '.normalize_for_match' do
    it 'NFKC 正規化と downcase と空白除去を組み合わせる' do
      # 全角ＡＢＣ → 半角abc、空白除去
      expect(described_class.normalize_for_match('ＡＢＣ DEF')).to eq('abcdef')
    end
  end
end
