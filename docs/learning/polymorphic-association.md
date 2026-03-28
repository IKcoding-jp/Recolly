# ポリモーフィック関連（Polymorphic Association）

## これは何か

1つのテーブルが、複数の異なるテーブルと関連を持てる仕組み。「画像」テーブル1つで、作品のカバー画像・ユーザーのプロフィール画像・感想の添付画像など、どのテーブルにも紐づけられる。

身近な例え: 宅配便の「届け先」を想像してほしい。普通は「自宅の住所」欄しかないが、ポリモーフィックは「届け先の種類（自宅/会社/コンビニ）」+「その住所」の2つの欄がある。これなら届け先の種類がいくら増えても、欄を追加する必要がない。

## もう少し詳しく

### 普通の関連の問題

画像を保存するテーブルが「作品」「ユーザー」「感想」のそれぞれと紐づく場合、普通に考えると：

```
images テーブル（普通のやり方）
├── id
├── s3_key
├── work_id          ← 作品のカバー画像用
├── user_id          ← プロフィール画像用
├── episode_review_id ← 感想の添付画像用
└── ...
```

この方法だと：
- **ほとんどのカラムがNULL（空）になる** — 作品のカバー画像なら `user_id` と `episode_review_id` は空
- **新しい用途が増えるたびにカラム追加が必要** — テーブル構造を変えるマイグレーションが毎回発生

### ポリモーフィック関連の解決策

「どのテーブルか」と「そのテーブルのどのレコードか」を2つのカラムで表現する：

```
images テーブル（ポリモーフィック）
├── id
├── s3_key
├── imageable_type   ← "Work" / "User" / "EpisodeReview"（テーブル名を文字列で保存）
└── imageable_id     ← そのテーブルのID
```

具体例：

| 画像の用途 | imageable_type | imageable_id | 意味 |
|-----------|---------------|-------------|------|
| カバー画像 | "Work" | 7 | Works テーブルの ID=7 の作品 |
| プロフィール | "User" | 3 | Users テーブルの ID=3 のユーザー |
| 感想の添付 | "EpisodeReview" | 12 | EpisodeReviews テーブルの ID=12 |

**新しい用途が増えても、カラムを追加する必要がない。** `imageable_type` に新しいテーブル名を書くだけ。

### Railsでの書き方

```ruby
# マイグレーション（テーブル作成）
create_table :images do |t|
  t.references :imageable, polymorphic: true, null: false
  # ↑ これだけで imageable_type と imageable_id の2カラムが自動で作られる
  t.string :s3_key, null: false
  t.timestamps
end

# Image モデル
class Image < ApplicationRecord
  belongs_to :imageable, polymorphic: true
end

# Work モデル
class Work < ApplicationRecord
  has_many :images, as: :imageable
end

# User モデル（将来）
class User < ApplicationRecord
  has_many :images, as: :imageable
end
```

使い方：
```ruby
# 作品のカバー画像を取得
work = Work.find(7)
work.images  # → この作品に紐づく全画像

# 画像から元のレコードを取得
image = Image.find(1)
image.imageable  # → Work か User か EpisodeReview が返る
```

### 名前の由来

「poly（多い）」+「morph（形）」= 多態的。1つの `images` テーブルの行が、Work の形にも User の形にも EpisodeReview の形にもなれるから。

## Recollyでどう使っているか

画像アップロード機能で使用予定:
- `app/models/image.rb` — ポリモーフィック関連で `imageable` を定義
- `app/models/work.rb` — `has_many :images, as: :imageable` を追加
- 最初の用途は手動登録時のカバー画像。将来的にプロフィール画像・感想添付画像にも拡張する

## なぜこれを選んだか

- 将来、カバー画像以外の用途（プロフィール画像、感想添付画像）が追加予定
- 用途ごとにテーブルを増やしたくない
- Railsが標準で強力にサポートしている

→ ADRは画像アップロード機能の実装時に作成予定

## 注意点・ハマりやすいポイント

- **インデックスを忘れない**: `imageable_type` と `imageable_id` の複合インデックスが必要。`t.references :imageable, polymorphic: true` で自動作成されるが、手動で作る場合は忘れやすい
- **外部キー制約が使えない**: DBレベルの外部キー制約は、参照先が複数テーブルになるため設定できない。データの整合性はアプリケーション側（Rails）で担保する
- **N+1問題**: `Image.all.map(&:imageable)` のように全画像の紐づき先を取得すると、画像1件ごとにSQLが発行される。`includes(:imageable)` を忘れないこと

## もっと知りたいとき

- [Rails ガイド — ポリモーフィック関連付け](https://railsguides.jp/association_basics.html#ポリモーフィック関連付け)
- [Rails API — belongs_to polymorphic](https://api.rubyonrails.org/classes/ActiveRecord/Associations/ClassMethods.html)
