class CreateRecommendations < ActiveRecord::Migration[8.1]
  def change
    create_table :recommendations do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.text :analysis_summary
      t.jsonb :preference_scores, default: []
      t.jsonb :genre_stats, default: []
      t.jsonb :top_tags, default: []
      t.jsonb :recommended_works, default: []
      t.jsonb :challenge_works, default: []
      t.integer :record_count, default: 0
      t.datetime :analyzed_at

      t.timestamps
    end
  end
end
