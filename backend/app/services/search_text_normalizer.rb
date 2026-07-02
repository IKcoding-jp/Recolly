# frozen_string_literal: true

# 検索クエリ・作品タイトルの表記揺れ吸収（NFKC正規化＋小文字化＋trim＋連続空白圧縮）
# キャッシュキーの生成とタイトル同士の比較の両方で使うため、1箇所に集約している
module SearchTextNormalizer
  module_function

  def normalize(text)
    text.to_s.unicode_normalize(:nfkc).downcase.strip.gsub(/\s+/, ' ')
  end
end
