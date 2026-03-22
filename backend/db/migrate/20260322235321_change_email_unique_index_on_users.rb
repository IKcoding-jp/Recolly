class ChangeEmailUniqueIndexOnUsers < ActiveRecord::Migration[8.0]
  def change
    remove_index :users, :email
    add_index :users, :email, unique: true, where: "email != ''"
  end
end
