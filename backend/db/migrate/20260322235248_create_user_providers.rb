class CreateUserProviders < ActiveRecord::Migration[8.0]
  def change
    create_table :user_providers do |t|
      t.references :user, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :provider_uid, null: false

      t.timestamps
    end

    add_index :user_providers, %i[provider provider_uid], unique: true
    add_index :user_providers, %i[user_id provider], unique: true
  end
end
