class AddUserToImages < ActiveRecord::Migration[8.1]
  # 画像の投稿者（アップロードした本人）を記録する。
  # 既存画像は投稿者不明のため null 許可。以降の投稿は必ず本人が入る（診断M-3 / ADR-0051）。
  def change
    add_reference :images, :user, null: true, foreign_key: true
  end
end
