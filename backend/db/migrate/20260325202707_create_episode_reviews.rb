class CreateEpisodeReviews < ActiveRecord::Migration[8.1]
  def change
    create_table :episode_reviews do |t|
      t.references :record, null: false, foreign_key: true
      t.integer :episode_number, null: false
      t.text :body, null: false
      t.integer :visibility, default: 0, null: false
      t.timestamps null: false
    end

    add_index :episode_reviews, [:record_id, :episode_number], unique: true
  end
end
