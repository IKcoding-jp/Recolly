class CreateMediaPreferenceProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :media_preference_profiles do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :media_type, null: false
      t.text :analysis_summary
      t.jsonb :preference_scores, default: []
      t.jsonb :top_tags, default: []
      t.jsonb :same_media_works, default: []
      t.jsonb :cross_media_works, default: []
      t.integer :record_count, default: 0
      t.datetime :analyzed_at
      t.timestamps
    end

    add_index :media_preference_profiles, [:user_id, :media_type], unique: true
  end
end
