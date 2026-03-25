# frozen_string_literal: true

class CreateRecordTags < ActiveRecord::Migration[8.1]
  def change
    # 中間テーブルのため timestamps は不要
    create_table :record_tags do |t| # rubocop:disable Rails/CreateTableWithTimestamps
      t.references :record, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true
    end

    # 同一record+tagの重複付与を防ぐ
    add_index :record_tags, %i[record_id tag_id], unique: true
  end
end
