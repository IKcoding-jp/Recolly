# frozen_string_literal: true

class AddFavoriteDisplayModeToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :favorite_display_mode, :string, default: 'ranking', null: false
  end
end
