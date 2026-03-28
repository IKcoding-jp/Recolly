# Queue Adapter（キューアダプタ）

## これは何か

「バックグラウンドジョブをどこに預けるか」を決める設定のこと。
レストランで例えると、注文（ジョブ）を厨房に伝える方法を選ぶようなもの。口頭で直接伝える（async）、伝票に書いて棚に置く（solid_queue）、外部の配達サービスに頼む（Sidekiq + Redis）など、やり方がいくつかある。

## もう少し詳しく

### バックグラウンドジョブとは

Webアプリでは「すぐにユーザーに返事しなくてもいい処理」がある。例えば：
- メール送信（数秒かかっても構わない）
- 画像のリサイズ（時間がかかる）
- 外部APIへの通知（失敗したらリトライしたい）

こういった処理を「後でやっておいて」と別の仕組みに任せるのがバックグラウンドジョブ。

### Active Jobとqueue adapterの関係

Railsには **Active Job** というフレームワークがある。これは「ジョブの書き方」を統一する仕組みで、実際の処理の実行方法は **queue adapter** に委ねている。

```
Active Job（統一インターフェース）
    ↓ ジョブを渡す
Queue Adapter（実行方法を決める）
    ↓
実際にジョブを処理する仕組み
```

つまり Active Job = 「何をするか」、Queue Adapter = 「どうやって実行するか」。

### 主なqueue adapterの種類

| アダプタ | 仕組み | メリット | デメリット |
|---------|--------|---------|-----------|
| `:async` | Webサーバーのメモリ内で実行 | 追加設定不要 | プロセス再起動でキューが消える |
| `:inline` | ジョブを即座に同期実行 | テスト向き | 並列処理できない |
| `:test` | ジョブを実行せず記録だけ | テストで「ジョブが投入されたか」を確認可能 | 実行されない |
| `:solid_queue` | DBにジョブを保存して実行 | 永続化される、リトライ可能 | DBテーブルが必要 |
| `:sidekiq` | Redisにジョブを保存して実行 | 高速、実績豊富 | Redis必須 |

### asyncの問題点

`:async` はWebサーバー（Puma）のプロセス内でジョブを実行する。つまり：

1. ジョブはメモリ上のキューに入る（DBに保存されない）
2. Pumaが再起動すると、キュー内のジョブは**全て消える**
3. ジョブが失敗しても自動リトライの仕組みがない
4. どんなジョブが実行中かを外部から確認できない

開発時やジョブが少ないMVP段階では問題ないが、本番で信頼性が求められる場面では不十分。

### Solid Queueの仕組み

Solid QueueはRails 8で公式採用されたジョブキューアダプタ。ジョブの情報をDBのテーブルに保存する。

```
ジョブ投入 → solid_queue_jobs テーブルに INSERT
    ↓
ワーカーがテーブルをポーリング（定期的に確認）
    ↓
ジョブを取り出して実行
    ↓
完了 or 失敗を記録
```

Redisのような追加インフラが不要で、既存のPostgreSQLだけで動く。

## Recollyでどう使っているか

### 設定ファイル

- **本番環境（現在）:** `backend/config/environments/production.rb`
  ```ruby
  config.active_job.queue_adapter = :async  # ← これをsolid_queueに変更予定
  ```

- **Solid Queue設定:** `backend/config/queue.yml`
  - ワーカーのスレッド数やポーリング間隔を定義

- **Puma統合:** `backend/config/puma.rb`
  ```ruby
  plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]
  ```
  - 環境変数でON/OFFを制御。ONにするとPumaプロセス内でSolid Queueのワーカーも動く

- **定期タスク:** `backend/config/recurring.yml`
  - 完了済みジョブのクリーンアップを1時間ごとに実行

### DBテーブル

- `backend/db/queue_schema.rb` にスキーマ定義あり
- `solid_queue_jobs`, `solid_queue_ready_executions` など8テーブル

### ジョブクラス

- `backend/app/jobs/application_job.rb`（基底クラスのみ、実装ジョブはまだない）

## なぜこれを選んだか

→ [ADR-0008](../adr/0008-検索キャッシュにredisを採用.md)

- Solidシリーズ（Cache, Queue, Cable）で統一する方針
- 追加インフラ（Redis等）を本番に持ち込まず、PostgreSQLだけで運用
- Rails 8公式機能であり、長期的なサポートが期待できる

## 注意点・ハマりやすいポイント

- **マイグレーション必須:** Solid Queueを使うにはDBにテーブルを作る必要がある。gemをインストールしただけでは動かない
- **async → solid_queue の切り替えタイミング:** queue_adapterを変更する前にマイグレーションを実行すること。逆にするとジョブ投入時にエラーになる
- **開発環境との差異:** 開発でasync、本番でsolid_queueだと、動作が微妙に異なる場合がある（ジョブの実行タイミングなど）
- **テスト環境:** `:test` アダプタを使うと、ジョブは実行されずキューに溜まるだけ。明示的に `perform_enqueued_jobs` を呼ぶ必要がある

## もっと知りたいとき

- [Active Job の基礎 - Rails ガイド](https://railsguides.jp/active_job_basics.html)
- [Solid Queue GitHub リポジトリ](https://github.com/rails/solid_queue)
- [Rails 8 の Solid Queue 公式ドキュメント](https://guides.rubyonrails.org/solid_queue.html)
