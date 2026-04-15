# Google Books カバー画像の Mixed Content 修正

**作成日**: 2026-04-15
**種別**: バグ修正
**対象**: 本番環境（recolly.net）でのカバー画像表示不具合

## 1. 背景

### 1.1 症状

本番環境のマイライブラリ (`https://recolly.net/library`) において、「本」カテゴリ（特に「技術書」タグフィルタ時に顕著）のカバー画像が **全て壊れた画像アイコンで表示される**。

### 1.2 環境差

- **開発環境**: 問題なく表示される
- **本番環境**: 壊れる

開発環境は HTTP（`http://localhost:5173` 等）で動作しているのに対し、本番環境は HTTPS（`https://recolly.net`）で動作しているため発生する、**環境依存の問題**。

### 1.3 影響範囲

- 影響メディア: **本（book）のみ**
  - アニメ・漫画・映画・ドラマ・ゲームのカバー画像は正常に表示される
- 影響ユーザー: 本の記録を持つ全ユーザー
- 影響機能: カバー画像を表示する全画面
  - マイライブラリ (`/library`)
  - ダッシュボード (`/dashboard`)
  - 作品詳細ページ (`/works/:id`)
  - 検索結果 (`/search`)
  - おすすめ (`/recommendations`)
  - ディスカッション / プロフィール等

## 2. 根本原因

### 2.1 Mixed Content ブロック

本番環境の HTTPS ページ内で、カバー画像の `<img src="http://books.google.com/...">` という HTTP リクエストをブラウザが **Mixed Content ポリシー**により自動的にブロックしている。

モダンブラウザは HTTPS ページ内で HTTP リソースを読み込むことを「混在コンテンツ」と呼び、通信経路の盗聴・改ざんリスクを理由にデフォルトで遮断する。

### 2.2 発生源

`backend/app/services/external_apis/google_books_adapter.rb:33`

```ruby
info.dig('imageLinks', 'thumbnail')
```

Google Books API が返す `volumeInfo.imageLinks.thumbnail` の値は、API 仕様上 `http://books.google.com/books/content?...` 形式で返ることが多い。現状の実装はこの URL を **一切正規化せずそのまま保存**している。

実際に本番 DB に保存されている URL の例:
```
http://books.google.com/books/content?id=SWxREAAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api
```

### 2.3 なぜ「本」のみか

外部API別の thumbnail URL プロトコル：

| API | メディア | プロトコル | 問題 |
|---|---|---|---|
| TMDB | 映画・ドラマ | `https://image.tmdb.org/...` | なし |
| AniList | アニメ・漫画 | `https://s4.anilist.co/...` | なし |
| IGDB | ゲーム | `https://images.igdb.com/...` | なし |
| openBD | 本（補完） | `https://cover.openbd.jp/...` | なし |
| **Google Books** | **本** | **`http://books.google.com/...`** | **本件** |

本のカバー画像の主な取得源である Google Books だけが `http://` を返すため、本のみ壊れる。

## 3. 修正方針

### 3.1 Adapter 層で URL を正規化する（根本修正）

`GoogleBooksAdapter#normalize` 内で、thumbnail URL のプロトコルを強制的に `https://` に書き換える。

```ruby
# before
info.dig('imageLinks', 'thumbnail')

# after
info.dig('imageLinks', 'thumbnail')&.sub(%r{\Ahttp://}, 'https://')
```

**なぜこれが有効か**: Google Books は同じパスを HTTPS でも配信している。プロトコル置換だけで同じ画像が取得できる。

**なぜ Adapter 層か**:
- 壊れた URL の発生源に最も近い場所で対処する（systematic-debugging 原則: Fix at source）
- 保存される時点で正規化されるので、DB・キャッシュ・API レスポンスすべてがクリーンになる
- フロント側の絆創膏的対応を避けられる

**代替案の却下理由**:
- **フロントで正規化する案**: 症状への絆創膏。DB には依然として http:// が残るため、他経路（API レスポンス・キャッシュ等）にも汚染が漏れ出す
- **Work モデルの `before_save` コールバック案**: 他の経路に http:// URL が入ってくる問題は現状存在せず、YAGNI。将来必要になった時点で追加する

### 3.2 既存データのバックフィル（Rails マイグレーション）

本番 DB に既に保存されている `http://books.google.com/` 始まりの `cover_image_url` を一括更新する。

```ruby
class NormalizeGoogleBooksCoverUrls < ActiveRecord::Migration[8.1]
  def up
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

  # 安全に逆方向実行できないため IrreversibleMigration を投げる。
  # 詳細は migration 本体のコメントを参照。
  def down
    raise ActiveRecord::IrreversibleMigration, '...'
  end
end
```

**安全策**:
- WHERE 句で `http://books.google.com/` に厳密に絞る → 他ドメインの URL を誤って書き換えない
- `down` は **`IrreversibleMigration` を投げる**（理由は下記）
- `updated_at` は更新しない（最終更新時刻を汚さない）※ `execute` による直 SQL は ActiveRecord コールバックを発火しないため、`updated_at` は自動更新されない

**`down` を不可逆にする理由**:

`up` 実行後は、DB 内で「`up` が変換した行」と「アダプタ正規化により新規登録された行」がどちらも `https://books.google.com/...` 形式になり、SQL レベルで両者を区別する手段がない。

そのため素朴な「逆 REPLACE」を `down` に書くと、アダプタ修正後にユーザーが正常登録した行までもが http:// に書き戻され、silent data corruption を引き起こす。これを物理的に防ぐため、Rails 標準の `ActiveRecord::IrreversibleMigration` を使う。

万一 dev で巻き戻したい場合は、本マイグレーション本体を一時的に書き換える運用とする。

### 3.3 検索結果キャッシュの無効化

`backend/app/services/work_search_service.rb:10`

```ruby
# before
CACHE_VERSION = 'v4'

# after
CACHE_VERSION = 'v5'  # Google Books URL を https に正規化（2026-04-15）
```

**理由**: 検索結果は `Rails.cache` で 12 時間キャッシュされている。バンプしないと、Adapter を修正しても最大 12 時間、古いキャッシュから `http://` URL が返り続ける。

## 4. テスト戦略（TDD）

### 4.1 Adapter spec の拡張

`backend/spec/services/external_apis/google_books_adapter_spec.rb` に以下のテストを追加する：

1. **http → https 正規化テスト**
   ```
   Google Books が http:// で始まる thumbnail を返した場合、
   正規化結果の cover_image_url は https:// で始まる
   ```

2. **冪等性テスト**
   ```
   Google Books が既に https:// の thumbnail を返した場合、
   URL がそのまま保持される（二重置換されない）
   ```

3. **nil 安全性テスト**
   ```
   imageLinks.thumbnail が存在しない場合、
   cover_image_url は nil のままエラーにならない
   ```

上記3ケースで十分とする。「http:// で始まる別ドメインの URL」は Adapter のテストケースとしては想定外（Google Books Adapter が Google Books 以外の URL を返すことはない）なので、試験しない。

### 4.2 先にテストを失敗させる

CLAUDE.md の TDD 原則に従い、**実装より先にテストを書いて失敗を確認**してから修正コードを書く。

### 4.3 マイグレーションの確認方法

Recolly では migration spec を書く慣習がない。代わりに **開発DB で動作確認**する：

1. テスト用の `http://books.google.com/...` レコードを手動 INSERT
2. `bin/rails db:migrate`
3. 対象レコードが `https://books.google.com/...` になっていることを SELECT で確認
4. `bin/rails db:rollback`
5. 元の `http://books.google.com/...` に戻っていることを確認

## 5. リスク・影響範囲

| # | リスク | 影響度 | 対策 |
|---|--------|--------|------|
| 1 | `https://books.google.com/...` が実は画像を返さない | 高 | 実装前に 1 つの URL をブラウザで実際に開いて画像が返ることを確認 |
| 2 | UPDATE 文が想定より広範囲に及ぶ | 高 | WHERE 句を `cover_image_url LIKE 'http://books.google.com/%'` に厳密に絞る |
| 3 | マイグレーション実行中のテーブルロック | 低 | 現時点の Recolly は登録ユーザー規模が小さく、`works` のレコード件数も限定的なため、単純な UPDATE は数秒オーダーで完了する見込み。心配なら実行直前に `SELECT COUNT(*) FROM works WHERE cover_image_url LIKE 'http://books.google.com/%'` で件数を実測する |
| 4 | キャッシュバンプで検索初回レスポンスが遅延 | 低 | 12 時間以内に全キーが自然に埋め戻る |
| 5 | Google Books の仕様変更で将来 https を返すようになる | 低 | 現状の置換ロジックは `http://` にマッチした場合のみ動くので、すでに `https://` ならスキップされる（冪等） |

## 6. ロールバック計画

| 対象 | ロールバック手段 |
|---|---|
| Adapter コード変更 | `git revert` でコード巻き戻し |
| DB データマイグレーション | **自動ロールバック不可**（§3.2 参照）。万一巻き戻す必要がある場合は、本マイグレーションを一時的に書き換えるか、別途 SQL を手動で実行する |
| キャッシュバージョン | `CACHE_VERSION` を `'v4'` に戻す（revert に含まれる） |

## 7. 動作確認計画（Step 5 で実施）

1. **ローカル dev**
   - マイグレーション往復テスト（§4.3）
   - Adapter テスト（`bin/rspec spec/services/external_apis/google_books_adapter_spec.rb`）の全パス
   - 実際に本を検索して新規記録を作り、`works.cover_image_url` が https:// で始まっていることを DB で確認
   - ブラウザで dev 環境を開き、カバー画像が表示されることを目視確認

2. **本番（マージ後のデプロイ確認）**
   - マイライブラリ画面で本のカバー画像が表示されること
   - DevTools Network タブで画像リクエストが全て HTTPS かつ 200 OK であること
   - Mixed Content ブロックのコンソールエラーが出ていないこと

## 8. スコープ外（今回はやらない）

- フロントエンドでの URL 正規化フォールバック
- `Work` モデルへの `before_save` コールバック
- Google Books 以外の API からの http:// URL 対応（他の API は https しか返さない実績）
- 手動登録 (`ManualWorkForm`) からの http:// URL 防御（現状 S3 直アップロードで https のみ）

これらは **いま問題になっていない**ため YAGNI の観点で今回のスコープから除外する。将来、別経路から http:// URL が入る問題が実際に発生した時点で再検討する。

## 9. 関連ファイル

- `backend/app/services/external_apis/google_books_adapter.rb`（修正）
- `backend/spec/services/external_apis/google_books_adapter_spec.rb`（テスト追加）
- `backend/app/services/work_search_service.rb`（CACHE_VERSION bump）
- `backend/db/migrate/YYYYMMDDHHMMSS_normalize_google_books_cover_urls.rb`（新規）
