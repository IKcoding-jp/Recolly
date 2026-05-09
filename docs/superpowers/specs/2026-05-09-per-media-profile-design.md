# per-media 好みプロファイル — 設計仕様書

## 概要

ユーザーの好み分析をメディア種別（アニメ・映画・ドラマ・本・漫画・ゲーム）ごとに分離し、おすすめページをメディア別タブ構成に再設計する。

**目的:**
1. メディア別の好みプロファイルをUIで可視化する
2. 「このメディアの好みから別メディアをおすすめ」というクロスメディアレコメンドの精度を上げる

**ページURL:** `/recommendations`（変更なし）

## 機能要件

### タブ構成

- 全7タブ: `全体 / アニメ / 映画 / ドラマ / 本 / 漫画 / ゲーム`
- 全タブを常時表示（記録ゼロのタブも非表示にしない）
- 各タブに記録数バッジを表示

### 各メディアタブの構成（3段構成）

1. **メディア別好み分析カード**
   - AI分析テキスト（200字程度）
   - 好み傾向スコアバー（5軸）
   - 左ボーダーカラーはそのメディアの `--color-{media_type}`
   - 「好み分析の詳細を見る」アコーディオン

2. **同メディア内おすすめ**（5件）
   - セクションタイトル: 「{メディア名}のおすすめ」
   - 既存の `RecommendedWorkCard` コンポーネントを流用

3. **クロスメディアおすすめ**（3件）
   - セクションタイトル: 「{メディア名}好きにおすすめの他メディア」
   - 各カードに「{メディア名}好みから」ラベルを付与
   - 既存の `RecommendedWorkCard` コンポーネントを流用

### タブ別の状態

| 状態 | 条件 | 表示内容 |
|---|---|---|
| ready | 記録3件以上 + 分析済み | 3段構成（分析＋同メディア＋クロスメディア） |
| insufficient_records | 記録1〜2件 | プログレスバー「あと○件必要です」 + 検索リンク |
| no_records | 記録0件 | 空状態「まだ記録がありません」 + 検索リンク |
| generating | バックグラウンドジョブ実行中 | スピナー + 「分析中...」 |

### 全体タブ

既存の「全体おすすめ」（グローバル分析 + 7件おすすめ + 3件チャレンジ）をそのまま維持する。デフォルト表示タブ。

### 最低記録数

メディア別分析の最低記録数: **3件**（全体分析の5件より低く設定。1メディアに絞るため傾向が出やすい）

### 更新トリガー

- 「分析を更新」ボタン: 全体分析とメディア別分析を両方トリガー（コントローラーから両ジョブを並列エンキュー）
- 自動更新: **全体の**記録数が前回の全体分析時から5件以上増えた場合に両ジョブを起動（既存の自動更新ロジックを拡張）。メディアごとに個別の増分チェックはしない

## アーキテクチャ

### 全体フロー

```
[「分析を更新」ボタン or 自動更新トリガー]
        ↓
[既存] RecommendationRefreshJob（全体分析）
[新規] MediaProfileRefreshJob
        ↓ 記録3件以上のメディア分だけ並列ジョブ起動
┌─────────────┬─────────────┬─────────────────────┐
│ anime ジョブ │ book ジョブ  │ ... （最大6ジョブ）  │
└─────────────┴─────────────┴─────────────────────┘
        ↓ 各メディア独立して実行
[MediaPreferenceAnalyzer]
        ↓
[MediaPreferencePromptBuilder] → Claude API呼び出し
        ↓
[media_preference_profiles テーブルに保存]
```

### 新規バックエンドコンポーネント

| コンポーネント | ファイル | 責務 |
|---|---|---|
| モデル | `app/models/media_preference_profile.rb` | DBへの永続化。1ユーザー×1メディア |
| アナライザー | `app/services/media_preference_analyzer.rb` | 1メディア分のデータ集計 + Claude API呼び出し |
| プロンプトビルダー | `app/services/media_preference_prompt_builder.rb` | メディア特化プロンプト生成 |
| ジョブ | `app/jobs/media_profile_refresh_job.rb` | 1メディア分の分析を非同期実行 |
| コントローラー | `app/controllers/api/v1/media_preference_profiles_controller.rb` | 全6件をまとめて返すAPIエンドポイント |

### 既存コンポーネントの変更

| コンポーネント | 変更内容 |
|---|---|
| `RecommendationsController` | `POST /refresh` で `RecommendationRefreshJob`（既存）と `MediaProfileRefreshJob`（新規）を同時にエンキュー |

### 新規フロントエンドコンポーネント

| コンポーネント | ファイル | 責務 |
|---|---|---|
| タブバー | `MediaTabBar.tsx` | 7タブ表示・切り替え・記録数バッジ |
| メディア別タブコンテンツ | `MediaTabContent.tsx` | ready/insufficient/no_records/generating の状態分岐 |
| メディア別サマリーカード | `MediaAnalysisSummaryCard.tsx` | そのメディアの分析カード（既存 `AnalysisSummaryCard` を参考に作成） |
| hooks | `useMediaProfiles.ts` | GET /api/v1/media_preference_profiles の呼び出し + 状態管理 |

### 既存フロントエンドコンポーネントの変更

| コンポーネント | 変更内容 |
|---|---|
| `RecommendationsPage.tsx` | タブバー追加。全体タブと各メディアタブの切り替えロジック追加 |
| `RecommendationsPage.module.css` | タブバー用スタイルを追加 |

既存の `RecommendedWorkCard`・`AnalysisSummaryCard`・`AnalysisDetail` はそのまま流用する。

## API設計

### エンドポイント

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/v1/media_preference_profiles` | 全6メディアのプロファイルを取得 | 必須 |

`POST /api/v1/recommendations/refresh` は既存のまま変更なし（内部でメディア別ジョブも起動するよう拡張）。

### GET /api/v1/media_preference_profiles

**レスポンス（200 OK）:**

```json
[
  {
    "media_type": "anime",
    "status": "ready",
    "analysis_summary": "感情的なカタルシスを重視する傾向が強く...",
    "preference_scores": [
      { "label": "感情的な深さ", "score": 9.1 },
      { "label": "伏線・構成力", "score": 8.7 },
      { "label": "キャラクター成長", "score": 8.3 },
      { "label": "世界観・設定", "score": 7.4 },
      { "label": "アクション", "score": 5.2 }
    ],
    "top_tags": [{ "name": "泣ける", "count": 8 }],
    "same_media_works": [
      {
        "title": "葬送のフリーレン",
        "media_type": "anime",
        "description": "...",
        "cover_url": "https://...",
        "reason": "VEに9点をつけたあなたへ。...",
        "external_api_id": "154587",
        "external_api_source": "anilist",
        "metadata": {}
      }
    ],
    "cross_media_works": [
      {
        "title": "風の谷のナウシカ",
        "media_type": "manga",
        "description": "...",
        "cover_url": "https://...",
        "reason": "アニメの世界観好きから。...",
        "external_api_id": "...",
        "external_api_source": "anilist",
        "metadata": {}
      }
    ],
    "record_count": 24,
    "analyzed_at": "2026-05-09T10:00:00+09:00"
  },
  {
    "media_type": "movie",
    "status": "insufficient_records",
    "record_count": 1,
    "required_count": 3
  },
  {
    "media_type": "game",
    "status": "no_records",
    "record_count": 0
  }
]
```

全6メディアを常に配列で返す（記録ゼロのメディアも `no_records` として含める）。

## データモデル

### media_preference_profiles テーブル（新規）

```ruby
create_table :media_preference_profiles do |t|
  t.references :user, null: false, foreign_key: true
  t.integer :media_type, null: false          # Work.media_type と同じ enum 値
  t.text :analysis_summary
  t.jsonb :preference_scores, default: []
  t.jsonb :top_tags, default: []
  t.jsonb :same_media_works, default: []      # 同メディア内おすすめ 5件
  t.jsonb :cross_media_works, default: []     # クロスメディアおすすめ 3件
  t.integer :record_count, default: 0
  t.datetime :analyzed_at
  t.timestamps
end

add_index :media_preference_profiles, [:user_id, :media_type], unique: true
```

**設計判断:**
- `user_id + media_type` に UNIQUE 制約。更新時は upsert（上書き）
- jsonb で柔軟に保存。分析結果の構造変更にマイグレーション不要

## Claude API連携

### プロンプト方針

メディア特化プロンプトを送ることで分析精度を上げる。

```
あなたはメディア作品のレコメンドアナリストです。
以下は「{media_type_ja}」ジャンルのみの記録データです。

■ 記録統計: {count}件 / 平均{avg}点
■ 高評価作品TOP5: ...
■ 断念作品: ...
■ よく使うタグ: ...
■ 感想テキスト抜粋: ...

出力:
{
  "summary": "{media_type_ja}での好み傾向（200字程度）",
  "preference_scores": [...],  // 5軸
  "same_media_keywords": [     // 同メディアのおすすめ候補 5件分のキーワード
    { "query": "作品タイトル", "reason": "..." }
  ],
  "cross_media_keywords": [    // 他メディアへのクロスおすすめ 3件分
    { "media_type": "manga", "query": "作品タイトル", "reason": "このアニメ好みから..." }
  ]
}
```

### コスト見積もり

- 入力: 約1,500〜2,000トークン（1メディアに絞るため既存より少ない）
- 出力: 約400〜600トークン
- 1メディアあたり: 約0.7〜1円
- 最大6メディア × 1円 = **最大6円/更新**
- モデル: `claude-haiku-4-5-20251001`（既存と同じ）

## フロントエンドUI設計

### タブバーのデザイン

- 各タブに記録数バッジ（`--color-{media_type}` 背景のアクティブ時）
- アクティブタブの下線カラーは `--color-{media_type}`
- 全体タブのアクティブ下線は `--color-text`

### スタイル一貫性ルール

| 要素 | 方針 |
|---|---|
| 作品カード | 既存 `RecommendedWorkCard`（横並びリスト形式）を流用 |
| 「おすすめの理由」ボックス | 既存 `.recReason` スタイルをそのまま使用 |
| サマリーカードの左ボーダー | 全体タブ: 全メディアグラデーション（既存）/ メディアタブ: そのメディアの単色 |
| コンテナ幅 | `max-width: 800px`（既存と統一） |
| アニメーション | 既存の `motion/react` + `useRecollyMotion` を使用 |

## エッジケース・エラー処理

- 分析中（generating）状態では前回の分析結果があれば薄く表示
- Claude APIエラー時: そのメディアのジョブのみ失敗。他メディアには影響しない
- 全メディア記録ゼロ: 全体タブのみ表示（タブバーは表示するが全メディアタブに空状態）
- クロスメディアおすすめの推薦先が全て記録済み: 「すべて記録済みです。分析を更新すると新しいおすすめが見つかるかもしれません」

## テスト戦略

### バックエンド（RSpec）

| テスト対象 | テスト内容 |
|---|---|
| `MediaPreferenceProfilesController` | 全6件レスポンス、未ログイン時401、各statusの返却 |
| `MediaPreferenceAnalyzer` | 記録3件未満でスキップ、データ集計ロジック、Claude APIモック |
| `MediaPreferencePromptBuilder` | メディア特化プロンプトの生成 |
| `MediaProfileRefreshJob` | ジョブ実行で分析結果が更新される |
| `MediaPreferenceProfile` モデル | user_id + media_type のUNIQUE制約 |

### フロントエンド（Vitest + React Testing Library）

| テスト対象 | テスト内容 |
|---|---|
| `RecommendationsPage` | タブ切り替えで表示が変わる、全体タブが初期表示 |
| `MediaTabBar` | 7タブの表示、記録数バッジ、アクティブ状態 |
| `MediaTabContent` | ready/insufficient/no_records/generating の各状態 |
| `useMediaProfiles` | APIレスポンスの取得、ローディング状態 |

## 将来の拡張（スコープ外）

- 「このメディアをもっと見る」でメディア別おすすめの件数拡張
- メディア別の「興味なし」フィードバック
- ダッシュボードにメディア別プロファイルウィジェット
