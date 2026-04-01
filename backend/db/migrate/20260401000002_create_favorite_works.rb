# frozen_string_literal: true

class CreateFavoriteWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :favorite_works do |t|
      t.references :user, null: false, foreign_key: true
      t.references :work, null: false, foreign_key: true
      t.integer :position, null: false

      t.timestamps
    end

    add_index :favorite_works, %i[user_id work_id], unique: true
    add_index :favorite_works, %i[user_id position], unique: true
  end
end
