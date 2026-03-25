class AddReviewFieldsToRecords < ActiveRecord::Migration[8.1]
  def change
    add_column :records, :review_text, :text
    add_column :records, :visibility, :integer, default: 0, null: false
  end
end
