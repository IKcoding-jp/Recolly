# frozen_string_literal: true

class CreateTags < ActiveRecord::Migration[8.1]
  def change
    create_table :tags do |t|
      t.string :name, null: false, limit: 30
      t.references :user, null: false, foreign_key: true
      t.timestamps null: false
    end

    add_index :tags, %i[user_id name], unique: true
  end
end
