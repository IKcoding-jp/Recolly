# Be sure to restart your server when you modify this file.

# Add new inflection rules using the following format. Inflections
# are locale specific, and you may define rules for as many different
# locales as you wish. All of these examples are active by default:
# ActiveSupport::Inflector.inflections(:en) do |inflect|
#   inflect.plural /^(ox)$/i, "\\1en"
#   inflect.singular /^(ox)en/i, "\\1"
#   inflect.irregular "person", "people"
#   inflect.uncountable %w( fish sheep )
# end

# 外部APIクライアントのクラス名を正しくCamelCaseに変換するためのアクロニム定義
# Zeitwerkはこの設定を使用してファイル名 → クラス名のマッピングを行う
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'AniList'
  inflect.acronym 'IGDB'
end
