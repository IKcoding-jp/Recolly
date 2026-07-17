# frozen_string_literal: true

# 検索クエリと作品タイトルの関連度を4段階のティアで判定する
# WorkSearchServiceのソート第1キーとして使う（関連度→品質→人気度。ADR-0045）
module SearchRelevanceScorer
  module_function

  TIER_EXACT = 3
  TIER_PREFIX = 2
  TIER_PARTIAL = 1
  TIER_NONE = 0

  def tier(query, title)
    q = safe_normalize(query)
    t = safe_normalize(title)
    return TIER_NONE if q.empty? || t.empty?
    return TIER_EXACT if t == q
    return TIER_PREFIX if t.start_with?(q)
    return TIER_PARTIAL if t.include?(q)

    TIER_NONE
  end

  # 外部APIから不正なUTF-8バイト列が返った場合にunicode_normalizeが例外を投げ
  # 検索全体が落ちるのを防ぐため、防御的に空文字（=TIER_NONE扱い）へ落とす
  def safe_normalize(text)
    SearchTextNormalizer.normalize(text)
  rescue ArgumentError, Encoding::UndefinedConversionError
    ''
  end
end
