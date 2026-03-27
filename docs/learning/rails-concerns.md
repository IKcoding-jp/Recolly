# Rails Concerns（コンサーン）

## これは何か

複数のコントローラー（やモデル）で使いたい共通機能を「部品」としてまとめる仕組み。
レゴブロックのように、必要なコントローラーにだけ組み込んで使える。

## もう少し詳しく

Railsでは、コントローラーやモデルに同じコードを何度も書くことがある。例えば「ログイン済みかチェックする」「ファイルをアップロードする」など。

Concernを使うと、この共通コードを1つのファイルにまとめて、必要な場所で `include` するだけで使えるようになる。

```ruby
# app/controllers/concerns/rememberable_auth.rb（部品の定義）
module RememberableAuth
  extend ActiveSupport::Concern  # ← Rails のconcern機能を有効化

  included do
    # includeされた時に自動実行されるブロック
    include ActionController::Cookies
  end
end

# 使う側
class SessionsController < ApplicationController
  include RememberableAuth  # ← これだけで機能が追加される
end
```

**`extend ActiveSupport::Concern`** がポイントで、これがあると：
- `included do ... end` ブロックが使える（includeされた時に実行される処理を書ける）
- 依存関係の自動解決（concern同士の組み合わせが楽になる）

### いつ使うべき？いつ使わないべき？

- **使うべき**: 同じロジック（メソッドやコールバック）を3箇所以上で共有する場合
- **使わなくてよい**: 重複が2-3行程度で、今後増える予定もない場合（過度な抽象化は読みにくさの原因になる）

## Recollyでどう使っているか

現時点では、concernの代わりに各コントローラーに個別includeする方針を採用している：

```ruby
# backend/app/controllers/api/v1/sessions_controller.rb
include ActionController::Cookies
include Devise::Controllers::Rememberable

# backend/app/controllers/api/v1/omniauth_callbacks_controller.rb
include ActionController::Cookies
include Devise::Controllers::Rememberable
```

3箇所×2行の重複だが、concernにするとファイルが1つ増え、「RememberableAuthって何？」とコードを追う手間が増える。YAGNI（必要になるまで作らない）原則に基づき、個別includeを選択した。

## なぜこれを選んだか

今回はconcernを使わない判断をした。ADRを作成するほどの技術選定ではないが、判断理由は以下：

- 重複は2行×3箇所のみ。今後増える予定なし
- concernにすると「追う先」が1ファイル増え、初見の読みやすさが下がる
- 各コントローラーで「何をincludeしているか」が一目でわかる方が保守しやすい

## 注意点・ハマりやすいポイント

- **APIモードではcookiesヘルパーが使えない**: Rails 8のAPIモード（`ActionController::API`）では、`cookies` メソッドがデフォルトで使えない。`ActionController::Cookies` を明示的にincludeする必要がある。通常のRailsアプリ（`ActionController::Base`）では不要
- **Devise::Controllers::Rememberable は自動includeされない**: `Devise::SessionsController` を継承していても、APIモードでは `remember_me` メソッドが使えないことがある。明示的なincludeが必要
- **concernの名前空間**: `app/controllers/concerns/` に置いたファイルはコントローラーでのみ使える。モデル用は `app/models/concerns/` に置く

## もっと知りたいとき

- [Rails Guide: Active Support Concerns](https://guides.rubyonrails.org/active_support_core_extensions.html#concern)
- [Rails API: ActiveSupport::Concern](https://api.rubyonrails.org/classes/ActiveSupport/Concern.html)
