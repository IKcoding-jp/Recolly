# マイグレーション（Database Migration）

## これは何か

データベースの構造変更（テーブルや列の追加・変更・削除）を、コードとして記録した「指示書」ファイル。
Gitのコミットが「コードの変更履歴」を管理するように、マイグレーションは「データベース構造の変更履歴」を管理する仕組み。

## もう少し詳しく

### なぜ必要か

チーム開発では全員が同じデータベース構造を使う必要がある。
手作業で「この列を追加して」と伝えると、誰かが忘れたりミスしたりして構造がバラバラになる。

マイグレーションファイルをGitで共有すれば、誰でも同じ変更を再現できる。

### 仕組み

1. 「データベースをこう変更してください」というRubyファイルを作る
2. そのファイルをGitでチームに共有する
3. 各メンバーが `rails db:migrate`（マイグレーション実行コマンド）を実行する
4. 全員のデータベースが同じ構造になる

### Gitとの対比

| | コード | データベース |
|---|---|---|
| 変更を記録する仕組み | Gitのコミット | マイグレーション |
| やること | 「この行を追加した」を記録 | 「この列を追加した」を記録 |
| 共有方法 | `git pull`で全員同じコードに | `rails db:migrate`で全員同じDB構造に |

## Recollyでどう使っているか

マイグレーションファイルは `backend/db/migrate/` に格納されている。

例: `backend/db/migrate/20260325202634_add_review_fields_to_records.rb`

```ruby
class AddReviewFieldsToRecords < ActiveRecord::Migration[8.1]
  def change
    add_column :records, :review_text, :text
    add_column :records, :visibility, :integer, default: 0, null: false
  end
end
```

- ファイル名の先頭 `20260325202634` はタイムスタンプ（作成日時）。実行順序を決める
- `add_column :records, :review_text, :text` → recordsテーブルにreview_text列（text型）を追加
- `add_column :records, :visibility, :integer` → recordsテーブルにvisibility列（integer型）を追加

## なぜこれを選んだか

Railsに標準で組み込まれている仕組み。特別な理由で選んだというより、Rails開発では当たり前に使うもの。

## 注意点・ハマりやすいポイント

- マイグレーションファイルは**一度実行したら編集しない**。間違えたら新しいマイグレーションで修正する（Gitのコミットを後から書き換えないのと同じ考え方）
- `rails db:migrate` は未実行のマイグレーションだけを実行する。どこまで実行したかはRailsが記録している
- マイグレーションの実行順はタイムスタンプ順。ファイル名を手で変えると順番が狂うので触らない

## もっと知りたいとき

- [Rails公式ガイド: Active Record マイグレーション](https://railsguides.jp/active_record_migrations.html)
