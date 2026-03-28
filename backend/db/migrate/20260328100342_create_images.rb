# frozen_string_literal: true

class CreateImages < ActiveRecord::Migration[8.1]
  def change
    create_table :images do |t|
      # ポリモーフィック関連（imageable_type + imageable_id）
      t.references :imageable, polymorphic: true, null: false

      t.string :s3_key, null: false
      t.string :file_name, null: false
      t.string :content_type, null: false
      t.integer :file_size, null: false

      t.timestamps
    end

    add_index :images, :s3_key, unique: true
  end
end
