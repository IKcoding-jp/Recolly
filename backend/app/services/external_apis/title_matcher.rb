# frozen_string_literal: true

module ExternalApis
  # 検索クエリと外部APIから返ってきた候補タイトルが「同じ作品」と判断できるか検証するモジュール
  #
  # 背景:
  # TMDB や Wikipedia の検索 API は曖昧マッチで、'進撃の巨人 Season 2' のような
  # シリーズ識別子付きクエリで親作品 '進撃の巨人' を返してしまうことがある。
  # その親作品の説明を補完に採用すると、シーズン違い・OVA・外伝など全く別の作品にも
  # 同じ親作品の説明が付与されてしまう regression が起きる。
  # この検証をクライアント側に挟み、明らかに別作品とみなせる場合は弾く。
  module TitleMatcher
    # 親/子作品とみなす長さの倍率閾値
    # この倍率以上の長さの差があり、長い方が短い方を含む場合は別作品扱いで却下する
    PARENT_CHILD_LENGTH_RATIO = 1.5

    module_function

    # クエリと結果のタイトルが「同じ作品」と判断できるかチェックする
    # 1. NFKC 正規化 + 小文字化 + 空白除去で軽微な表記揺れを吸収
    # 2. 完全一致なら true
    # 3. 一方が他方の1.5倍以上長く、長い方が短い方を含む場合は親/子作品とみなして却下
    #    例: '進撃の巨人 Season 2' (12) vs '進撃の巨人' (5) → 1.5倍以上 + 含む → false
    # 4. それ以外で部分一致するなら採用（軽微な表記揺れの吸収）
    def title_match?(query, candidate)
      return false if query.blank? || candidate.blank?

      q = normalize_for_match(query)
      c = normalize_for_match(candidate)
      return true if q == c
      return false if parent_child_mismatch?(q, c)

      q.include?(c) || c.include?(q)
    end

    # 全角/半角、大小文字、空白の表記揺れを吸収する
    # NFKC 正規化で全角英数字・記号は半角化され、全角空白も半角空白になる
    def normalize_for_match(text)
      text.unicode_normalize(:nfkc).downcase.gsub(/\s+/, '')
    end

    # 一方が他方の PARENT_CHILD_LENGTH_RATIO 倍以上長く、長い方が短い方を含むか判定する
    # 真なら「親作品 vs 子作品（シーズン/OVA/外伝等）」とみなして却下対象になる
    def parent_child_mismatch?(left, right)
      (left.length > right.length * PARENT_CHILD_LENGTH_RATIO && left.include?(right)) ||
        (right.length > left.length * PARENT_CHILD_LENGTH_RATIO && right.include?(left))
    end
  end
end
