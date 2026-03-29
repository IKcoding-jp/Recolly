# frozen_string_literal: true

class CreateDiscussions < ActiveRecord::Migration[8.1]
  def change
    create_table :discussions do |t|
      t.references :work, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :episode_number
      t.string :title, null: false
      t.text :body, null: false
      t.boolean :has_spoiler, null: false, default: false
      t.integer :comments_count, null: false, default: 0
      t.timestamps
    end
    add_index :discussions, %i[work_id created_at]
  end
end
