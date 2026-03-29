class AddLastSyncedAtToWorks < ActiveRecord::Migration[8.1]
  def change
    add_column :works, :last_synced_at, :datetime
  end
end
