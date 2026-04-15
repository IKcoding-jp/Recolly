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

  # データマイグレーションは安全に逆方向実行できない。
  # 理由: up 実行後は「up が変換した行」と「アダプタ修正後にユーザーが新規登録した行」
  #   がどちらも https://books.google.com/... となり SQL レベルで区別できないため、
  #   素朴な逆 REPLACE は後者の正常データまで http:// に書き戻してしまう（silent corruption）。
  #   どうしても巻き戻す必要がある場合は、本マイグレーション本体を一時的に書き換えて
  #   dev DB だけで使うか、別途データ修正マイグレーションを起こすこと。
  def down
    raise ActiveRecord::IrreversibleMigration,
          'NormalizeGoogleBooksCoverUrls は逆方向実行できません: ' \
          'up 実行後は「up が変換した行」と「アダプタ正規化で新規作成された行」を ' \
          'SQL レベルで区別できず、素朴な逆 REPLACE は後者を破壊するため。詳細はクラスコメント参照。'
  end
end
