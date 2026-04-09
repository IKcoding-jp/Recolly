# frozen_string_literal: true

# users テーブルに password_set_at カラムを追加し、既存ユーザーをバックフィルする。
# 詳細は ADR-0036 を参照。
class AddPasswordSetAtToUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :password_set_at, :datetime, null: true

    # バックフィル: encrypted_password が空文字ではない既存ユーザーに現在時刻を設定。
    # これにより「自分でパスワードを設定済みのユーザー」として扱われる。
    # 空文字のユーザー（過去の OAuth 専用ユーザー）は NULL のまま残し、
    # UI 上は「パスワード未設定」と正しく表示される。
    execute <<~SQL.squish
      UPDATE users
      SET password_set_at = NOW()
      WHERE encrypted_password IS NOT NULL AND encrypted_password != ''
    SQL
  end

  def down
    remove_column :users, :password_set_at
  end
end
