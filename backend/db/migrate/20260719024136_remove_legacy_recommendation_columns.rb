# 一括生成方式への移行で使わなくなったカラムを削除する
# （総合の作品リストはメディア別タブへ一本化、メディア別スコアは廃止）
class RemoveLegacyRecommendationColumns < ActiveRecord::Migration[8.1]
  def change
    remove_column :recommendations, :recommended_works, :jsonb, default: []
    remove_column :recommendations, :challenge_works, :jsonb, default: []
    remove_column :media_preference_profiles, :cross_media_works, :jsonb, default: []
    remove_column :media_preference_profiles, :preference_scores, :jsonb, default: []
    remove_column :media_preference_profiles, :top_tags, :jsonb, default: []
  end
end
