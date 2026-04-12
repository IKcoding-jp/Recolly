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
      it 'クエリが親と異なる接尾辞を持つ場合は false（normalize後の完全一致のみ採用）' do
        # '進撃の巨人 Season 2' と '進撃の巨人' は normalize 後でも別物
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

    context '逆方向（候補の方が長い場合）' do
      it 'false を返す（normalize後の完全一致のみ採用）' do
        expect(described_class.title_match?('進撃の巨人', '進撃の巨人 Season 2')).to be false
      end
    end

    context '短いタイトルでの誤マッチ防止' do
      it '短いタイトル + 1.5倍以下の部分一致は false（呪術廻戦 vs 呪術廻戦 0 等）' do
        expect(described_class.title_match?('呪術廻戦 0', '呪術廻戦')).to be false
      end

      it 'タイトルがほぼ等しいが1文字違うナンバリング（FF vs FFX 等）は false' do
        expect(described_class.title_match?('FFX', 'FF')).to be false
        expect(described_class.title_match?('ペルソナ4', 'ペルソナ')).to be false
      end
    end

    context '英語クエリと日本語ローカライズ名の照合' do
      it '英語クエリと日本語ローカライズ名は照合不能（false）であることを明示的にテスト' do
        # AniList の title_english フォールバック経路で TMDB から日本語ローカライズ名が
        # 返ってきた場合、 normalize 後も照合不能になることを文書化する
        expect(described_class.title_match?('Attack on Titan', '進撃の巨人')).to be false
        expect(described_class.title_match?('Steins;Gate', 'シュタインズ・ゲート')).to be false
      end
    end

    context '不正な UTF-8 バイト列が含まれる場合' do
      it '安全に false を返す' do
        invalid = "\xff\xfe".dup.force_encoding('UTF-8')
        expect(described_class.title_match?('進撃の巨人', invalid)).to be false
        expect(described_class.title_match?(invalid, '進撃の巨人')).to be false
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

      it '空白だけの文字列は false を返す（blank? で弾かれる）' do
        expect(described_class.title_match?('   ', '進撃の巨人')).to be false
        expect(described_class.title_match?('進撃の巨人', "\u3000\u3000")).to be false
      end
    end
  end

  describe '.normalize_for_match' do
    it 'NFKC 正規化と downcase と空白除去を組み合わせる' do
      # 全角ＡＢＣ → 半角abc、空白除去
      expect(described_class.normalize_for_match('ＡＢＣ DEF')).to eq('abcdef')
    end

    it '不正な UTF-8 バイト列に対しては空文字を返す' do
      invalid = "\xff\xfe".dup.force_encoding('UTF-8')
      expect(described_class.normalize_for_match(invalid)).to eq('')
    end
  end
end
