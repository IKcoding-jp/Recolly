# おすすめ機能 — 設計仕様書

## 概要

ユーザーの記録データ（評価・ステータス・ジャンル・タグ・感想テキスト）をLLM（Claude API）で分析し、ジャンルを横断した作品をおすすめする機能。

**ページURL:** `/recommendations`

**差別化ポイント:** Recollyは6ジャンル（アニメ・映画・ドラマ・本・漫画・ゲーム）を横断して記録できるアプリ。この横断データをLLMで分析し、「アニメが好きなあなたに、この映画もどうですか」というジャンルを超えたレコメンドができるのが独自の強み。

## 機能要件

### おすすめ生成

- コンテンツベースのレコメンド（ユーザー自身のデータのみで完結）
- 外部API（TMDB, AniList, Google Books, IGDB）から作品を検索して候補を取得
- 記録済みの作品は除外
- 2セクション構成:
  - **あなたへのおすすめ**（7件）— 好みに合った作品
  - **いつもと違うジャンルに挑戦**（3件）— 普段あまり触れないジャンルから

### 好み分析

- Claude API（claude-haiku-4-5）でユーザーの好み傾向を自然言語で分析
- 段階的な分析（データ量に応じて精度が上がる）:
  - **レベル1（最低限）:** 評価 + ジャンル + metadata.genres — 「アニメのファンタジー系に高評価が集中」程度
  - **レベル2（+タグ）:** 上記 + ユーザータグ — 「"泣ける"タグの作品は平均9点」のような深い分析
  - **レベル3（+感想）:** 上記 + EpisodeReviewのテキスト — 「伏線回収や心理描写に言及する感想が多い」のような最も深い分析
- タグや感想がないユーザーでも動作する（ある分だけ渡す）
- 分析結果:
  - 好み傾向テキスト（200字程度）
  - 好みの傾向スコア（5軸、1.0〜10.0）
  - ジャンル別統計（記録数、平均評価）
  - よく使うタグ（使用回数付き）

### おすすめの理由

各おすすめ作品に「おすすめの理由」を表示する。理由には以下を含める:
- ユーザーが高評価した**具体的な作品名**を引用
- 共通する要素を**具体的なマッチポイント**として提示
- ユーザーの**感想テキストの引用**（あれば）

例: 「ヴァイオレット・エヴァーガーデンに9点をつけたあなたへ。これらの作品に共通する"失われたものへの向き合い方"を、旅と出会いを通じて描く作品です。」

### 更新頻度

- **自動更新:** 記録が前回の分析時から5件以上増えたらSolid Queueジョブで自動再分析
- **手動更新:** 「分析を更新」ボタンで即時再分析をトリガー
- 分析結果はDBに永続化（LLM APIのコストが高いため）

## アーキテクチャ

### 全体フロー

```
[ユーザーがページを開く]
    ↓
[GET /api/v1/recommendations]
    ↓
[RecommendationsController]
    ├── DB に分析結果あり → そのまま返す
    └── なし → RecommendationService を呼ぶ
                    ↓
            ┌───────┴───────┐
            ↓               ↓
    [PreferenceAnalyzer]  [WorkRecommender]
    記録データ集計         好み → 外部API検索
    Claude APIで分析      おすすめ作品取得
            ↓               ↓
            └───────┬───────┘
                    ↓
            [結果をDB保存]
            [JSONレスポンス返却]
```

### バックエンドコンポーネント

| コンポーネント | ファイル | 責務 |
|---|---|---|
| Controller | `app/controllers/api/v1/recommendations_controller.rb` | APIエンドポイント。DB確認 → 返却 |
| Service（調整役） | `app/services/recommendation_service.rb` | 全体の調整。分析とおすすめ生成を組み合わせる |
| 好み分析 | `app/services/preference_analyzer.rb` | 記録データ集計 + Claude APIで好み分析テキスト生成 |
| おすすめ生成 | `app/services/work_recommender.rb` | 好み分析の結果をもとに外部APIで作品を検索 |
| 非同期ジョブ | `app/jobs/recommendation_refresh_job.rb` | Solid Queueジョブ。自動・手動更新を非同期実行 |
| モデル | `app/models/recommendation.rb` | DBへの永続化。1ユーザー1レコード |

### フロントエンドコンポーネント

| コンポーネント | ファイル | 責務 |
|---|---|---|
| ページ | `RecommendationsPage.tsx` | ページ本体。状態に応じた表示分岐 |
| スタイル | `RecommendationsPage.module.css` | ページ固有のスタイル |
| サマリーカード | `AnalysisSummaryCard.tsx` | AI分析サマリー + アコーディオン展開 |
| 分析詳細 | `AnalysisDetail.tsx` | 展開される詳細部分（ジャンル統計、傾向スコア、タグ） |
| おすすめ作品カード | `RecommendedWorkCard.tsx` | 作品1件のカード（カバー、情報、理由、記録ボタン） |
| hooks | `useRecommendations.ts` | API呼び出し + 状態管理 |

## API設計

### エンドポイント

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/v1/recommendations` | おすすめ結果を取得 | 必須 |
| POST | `/api/v1/recommendations/refresh` | 手動で分析を再実行 | 必須 |

### GET /api/v1/recommendations

**レスポンス（200 OK）:**

```json
{
  "recommendation": {
    "analysis": {
      "summary": "あなたはキャラクターの成長を描く作品に高い評価をつける傾向があります...",
      "preference_scores": [
        { "label": "キャラクター重視", "score": 9.2 },
        { "label": "伏線・構成力", "score": 8.7 },
        { "label": "世界観・設定", "score": 8.1 },
        { "label": "社会派テーマ", "score": 7.4 },
        { "label": "アクション", "score": 6.5 }
      ],
      "genre_stats": [
        { "media_type": "anime", "count": 24, "avg_rating": 8.2 }
      ],
      "top_tags": [
        { "name": "名作", "count": 12 }
      ]
    },
    "recommended_works": [
      {
        "title": "葬送のフリーレン",
        "media_type": "anime",
        "description": "勇者一行の魔法使いフリーレンが...",
        "cover_url": "https://...",
        "reason": "ヴァイオレット・エヴァーガーデンに9点をつけたあなたへ。共通する"失われたものへの向き合い方"を描く作品です。",
        "external_api_id": "154587",
        "external_api_source": "anilist",
        "metadata": { "genres": ["Fantasy", "Drama"], "season_year": 2023 }
      }
    ],
    "challenge_works": [
      {
        "title": "コンビニ人間",
        "media_type": "book",
        "description": "...",
        "cover_url": "https://...",
        "reason": "「本」の記録はまだ5件と少なめですが、社会派テーマ好きのあなたへ。",
        "external_api_id": "...",
        "external_api_source": "google_books",
        "metadata": {}
      }
    ],
    "analyzed_at": "2026-04-05T14:30:00+09:00",
    "record_count": 70
  }
}
```

**記録0件時のレスポンス（200 OK）:**

```json
{
  "recommendation": null,
  "status": "no_records"
}
```

**記録1〜4件時のレスポンス（200 OK）:**

```json
{
  "recommendation": {
    "analysis": null,
    "recommended_works": [],
    "challenge_works": [],
    "genre_stats": [
      { "media_type": "anime", "count": 2, "avg_rating": 8.0 }
    ],
    "record_count": 2,
    "required_count": 5
  },
  "status": "insufficient_records"
}
```

### POST /api/v1/recommendations/refresh

**レスポンス（202 Accepted）:**

```json
{
  "message": "分析を開始しました",
  "status": "processing"
}
```

非同期ジョブとして実行。完了後、次のGETリクエストで最新結果を返す。

## データモデル

### recommendations テーブル

```ruby
create_table :recommendations do |t|
  t.references :user, null: false, foreign_key: true, index: { unique: true }
  t.text :analysis_summary           # AI分析テキスト
  t.jsonb :preference_scores, default: [] # [{ label: "...", score: 9.2 }, ...]
  t.jsonb :genre_stats, default: []       # [{ media_type: "anime", count: 24, avg_rating: 8.2 }, ...]
  t.jsonb :top_tags, default: []          # [{ name: "名作", count: 12 }, ...]
  t.jsonb :recommended_works, default: [] # おすすめ作品7件
  t.jsonb :challenge_works, default: []   # 挑戦作品3件
  t.integer :record_count, default: 0     # 分析時の記録数
  t.datetime :analyzed_at                 # 最終分析日時
  t.timestamps
end
```

**設計判断:**
- 1ユーザー1レコード（user_idにUNIQUEインデックス）。更新時は上書き
- jsonbカラムで柔軟に保存（分析結果の構造変更にマイグレーション不要）
- Rails.cacheではなくDBに永続化（LLM APIのコストが高いため、再起動で消えると困る）

## Claude API連携

### 使用モデル

`claude-haiku-4-5`（コスト抑制。分析精度が十分な最小モデル）

### コスト見積もり

- 入力: 約2,000〜3,000トークン（記録データ）
- 出力: 約500〜800トークン（分析結果）
- 1回あたり約$0.007（約1円）
- 月に数回更新する想定で、1ユーザーあたり月10円未満

### Claude APIに送るデータ

ユーザーの記録を集計した以下のデータを送る（ある分だけ）:

1. ジャンル別統計: `{ anime: { count: 24, avg_rating: 8.2, completed: 20, dropped: 1 }, ... }`
2. 高評価作品TOP10: `[{ title, media_type, rating, genres }]`
3. 低評価・断念作品: `[{ title, media_type, rating, genres }]`
4. タグ集計: `[{ name: "名作", count: 12, avg_rating: 9.1 }]`（あれば）
5. 感想テキスト抜粋: `["伏線回収が見事", "キャラに深みがある", ...]`（あれば）
6. お気に入り作品: `[{ title, media_type, genres }]`（あれば）

### プロンプト方針

```
あなたはメディア作品のレコメンドアナリストです。
以下のユーザーの視聴・閲覧記録データを分析してください。

■ 出力1: 好み傾向の分析（200字程度）
- ジャンルを横断した共通の好みパターンを見つけてください
- 具体的な作品名や感想の言葉を引用してください
- 定型的な表現を避け、このユーザーならではの傾向を述べてください

■ 出力2: 好み傾向スコア（5項目）
- データから読み取れる嗜好の軸を5つ選び、1.0〜10.0でスコアリング

■ 出力3: おすすめ検索キーワード
- この人が好みそうな作品を外部APIで検索するためのキーワードをジャンル別に生成
- recommended: 好みに合うキーワード（7作品検索用）
- challenge: 普段触れないジャンルだが好みそうなキーワード（3作品検索用）

■ 出力4: おすすめの理由テンプレート
- 各キーワードに対して、ユーザーの具体的な作品名・評価・感想を引用した理由文を生成

JSON形式で出力してください。
```

## フロントエンドUI設計

### ページ構成（B案: コンパクトサマリー + おすすめ）

```
/recommendations ページ

┌─────────────────────────────────┐
│ おすすめ                          │ ← ページタイトル
│ あなたの記録データから好みを分析...    │ ← サブタイトル
├─────────────────────────────────┤
│ ○ 70件の記録をもとに分析 ・ 4月5日  │ [分析を更新] ← 更新バー
├─────────────────────────────────┤
│ ┃ あなたの好み傾向     [AI分析]    │ ← サマリーカード
│ ┃ キャラクターの成長を描く作品に...   │   （左端にグラデーションライン）
├─────────────────────────────────┤
│ [好み分析の詳細を見る ▼]           │ ← アコーディオン展開ボタン
│   （展開時: ジャンル統計、傾向スコア、 │
│    よく使うタグ）                   │
├─────────────────────────────────┤
│ あなたへのおすすめ                  │ ← セクションタイトル
│ ┌───────────────────────────┐   │
│ │ [Cover] 葬送のフリーレン  [記録] │   │ ← おすすめ作品カード × 7
│ │         アニメ ・ 2023年        │   │
│ │ ┌おすすめの理由──────────┐ │   │
│ │ │ VEに9点をつけたあなたへ... │ │   │
│ │ └──────────────────────┘ │   │
│ └───────────────────────────┘   │
│ （7件）                           │
├─────────────────────────────────┤
│ いつもと違うジャンルに挑戦           │ ← セクションタイトル（緑色）
│ （3件）                           │
└─────────────────────────────────┘
```

### インタラクション

- **カバー画像クリック** → 作品詳細ページ（/works/:id）に遷移
- **「記録する」ボタン** → 記録モーダルを表示（検索ページと同じパターン）
- **「分析を更新」ボタン** → POST /api/v1/recommendations/refresh を呼び出し、ローディング表示
- **「好み分析の詳細を見る」** → アコーディオンで展開（インライン）

### デザイン方針

- 既存の共通コンポーネント（SectionTitle, Badge, Button, Rating等）を活用
- デザイントークン（CSS変数）のみ使用。ハードコード禁止
- ジャンル別カラー（tokens.css定義済み）をバッジ・統計カードに適用

## エッジケース・エラー処理

### 状態別表示

| 状態 | 条件 | 表示内容 |
|---|---|---|
| 記録なし | 記録0件 | 空状態。「作品を記録しておすすめを受け取ろう」+ 検索ページへのボタン |
| 記録少数 | 記録1〜4件 | プログレスバー「あと○件でAI分析が使えます」+ 現在のジャンル別統計 |
| 通常 | 記録5件以上 | AI分析サマリー + おすすめ作品リスト |
| 更新中 | ジョブ実行中 | スピナー + 「1〜2分かかることがあります」+ 前回結果を薄く表示 |
| エラー（前回結果あり） | API失敗 | エラーメッセージ + リトライボタン + 前回結果を表示 |
| エラー（初回） | 初回API失敗 | エラーメッセージ + リトライボタン |
| 全作品記録済み | おすすめ作品が全て記録済み | 「全て記録済みです！分析を更新すると新しいおすすめが見つかるかもしれません」 |

### 最低記録数

- AI分析に必要な最低記録数: **5件**
- 理由: 3件以下ではジャンルの傾向が出づらく、LLMに渡しても浅い分析しかできない

## テスト戦略

### バックエンド（RSpec）

| テスト対象 | テスト内容 |
|---|---|
| `RecommendationsController` | 正常系レスポンス、未ログイン時401、記録0件時の空レスポンス、記録少数時 |
| `RecommendationService` | キャッシュヒット時にAPIを呼ばない、キャッシュミス時に分析→おすすめ生成 |
| `PreferenceAnalyzer` | 記録データの集計ロジック、段階的分析（タグあり/なし、感想あり/なし）、Claude APIモック |
| `WorkRecommender` | 外部API検索の呼び出し、記録済み作品の除外、7件 + 3件の分割 |
| `RecommendationRefreshJob` | ジョブ実行で分析結果が更新される、エラー時のリトライ |
| `Recommendation`モデル | バリデーション（user_idユニーク制約）、jsonbカラムの読み書き |

Claude APIと外部APIはモックして固定レスポンスを返す。

### フロントエンド（Vitest + React Testing Library）

| テスト対象 | テスト内容 |
|---|---|
| `RecommendationsPage` | 正常表示、空状態（記録0件）、記録少数状態、ローディング、エラー |
| `AnalysisSummaryCard` | サマリー表示、アコーディオン展開/閉じる |
| `RecommendedWorkCard` | 作品情報の表示、「記録する」ボタンクリック、カバークリックで遷移 |
| `useRecommendations` | APIレスポンスの取得、更新ボタンのPOSTリクエスト |

## 将来の拡張（スコープ外）

- 協調フィルタリング（ユーザー数が増えた段階で追加）
- おすすめの「いいね」「興味なし」フィードバック
- ダッシュボードへのおすすめウィジェット表示
