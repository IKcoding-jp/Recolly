# frozen_string_literal: true

class CreateRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :records do |t|
      t.references :user, null: false, foreign_key: true
      t.references :work, null: false, foreign_key: true
      t.integer :status, null: false, default: 4
      t.integer :rating
      t.integer :current_episode, default: 0
      t.integer :rewatch_count, default: 0
      t.date :started_at
      t.date :completed_at

      t.timestamps null: false
    end

    # 同じユーザーが同じ作品を二重記録できない
    add_index :records, [:user_id, :work_id], unique: true
  end
end
