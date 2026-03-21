# AniListAdapterのファイル名（anilist_adapter.rb）をZeitwerkが正しくCamelCaseに変換するためのアクロニム定義
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'AniList'
end
