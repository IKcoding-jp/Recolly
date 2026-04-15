# frozen_string_literal: true

# 本番で保存済みの Google Books thumbnail URL を http:// → https:// に一括更新する。
# Google Books API が返す thumbnail URL は http:// 形式が多く、
# HTTPS ページで Mixed Content としてブロックされる問題への対処（#155）。
# 新規登録分は GoogleBooksAdapter 側で正規化されるが、履歴データは本マイグレーションで修正する。
class NormalizeGoogleBooksCoverUrls < ActiveRecord::Migration[8.1]
  def up
    # WHERE 句で books.google.com 固定に絞り、無関係ドメインを誤って書き換えないようにする
    execute <<~SQL.squish
      UPDATE works
      SET cover_image_url = REPLACE(
        cover_image_url,
        'http://books.google.com/',
        'https://books.google.com/'
      )
      WHERE cover_image_url LIKE 'http://books.google.com/%'
    SQL
  end

  def down
    execute <<~SQL.squish
      UPDATE works
      SET cover_image_url = REPLACE(
        cover_image_url,
        'https://books.google.com/',
        'http://books.google.com/'
      )
      WHERE cover_image_url LIKE 'https://books.google.com/%'
    SQL
  end
end
