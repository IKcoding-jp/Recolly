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
    module_function

    # クエリと結果のタイトルが「同じ作品」と判断できるかチェックする
    # NFKC 正規化 + 小文字化 + 空白除去で軽微な表記揺れを吸収した上で、
    # 完全一致のみを採用する。
    #
    # 部分一致 fallback や「1.5倍以上の長さ差」ルールは過去に試したが、
    # '呪術廻戦 0' vs '呪術廻戦' や 'FFX' vs 'FF' のような短いナンバリングタイトルで
    # 誤マッチが起きるため廃止した。表記揺れは normalize_for_match で吸収する方針。
    def title_match?(query, candidate)
      return false if blank_or_invalid?(query) || blank_or_invalid?(candidate)

      q = normalize_for_match(query)
      c = normalize_for_match(candidate)
      return false if q.empty? || c.empty?

      q == c
    end

    # 全角/半角、大小文字、空白の表記揺れを吸収する
    # NFKC 正規化で全角英数字・記号は半角化され、全角空白も半角空白になる
    #
    # 外部 API から不正な UTF-8 バイト列が返ってきた場合に
    # unicode_normalize が ArgumentError を投げると検索全体が落ちるため、
    # 防御的に rescue して空文字を返す（title_match? で false 扱いになる）。
    def normalize_for_match(text)
      text.unicode_normalize(:nfkc).downcase.gsub(/\s+/, '')
    rescue ArgumentError, Encoding::UndefinedConversionError
      ''
    end

    # nil / 空文字 / 空白だけの文字列 / 不正な UTF-8 バイト列を含む文字列を弾く
    # ActiveSupport の blank? は内部で strip を呼ぶため、不正な UTF-8 でも
    # ArgumentError が発生する。それを安全に false（=「使えない」）扱いする。
    def blank_or_invalid?(text)
      text.blank?
    rescue ArgumentError, Encoding::UndefinedConversionError
      true
    end
  end
end
