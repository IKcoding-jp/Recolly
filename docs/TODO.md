# Recolly 開発進捗

仕様書: `docs/superpowers/specs/2026-03-20-recolly-design.md`

---

## フェーズ0: 開発環境整備

- [x] CLAUDE.md作成（厳格ルール定義）
- [x] hooks設定（lint + テスト自動実行）
- [x] Docker環境構築
- [x] モノレポの初期構成（backend / frontend / infra / docs）
- [x] CI設定（GitHub Actions: lint, test, security scan）
- [x] デザインシステム基盤（CSS変数, Typography, Button, Divider, SectionTitle）

---

## フェーズ1: 基盤 + 記録機能（MVP）

**→ ここまでで「使えるプロダクト」になる**

### 認証
- [x] メール + パスワード認証（devise + セッションCookie）— PR #14, ADR-0007
- [ ] Google OAuth
- [ ] X（Twitter）OAuth

### 作品検索・外部API連携
- [x] 作品検索ページ（キーワード + ジャンルフィルタ）— PR #19
- [x] TMDB連携（映画・ドラマ）— ADR-0008
- [x] AniList連携（アニメ・漫画）— ADR-0009
- [x] Google Books連携（本）— ADR-0010
- [x] IGDB連携（ゲーム）— ADR-0011
- [x] 手動作品登録フォーム

### 記録機能
- [x] 記録作成（検索結果から記録）— PR #19
- [x] 記録の詳細機能（ステータス変更・10点満点評価・進捗管理）— PR #21
- [x] ステータス変更時の自動処理（日付セット、話数同期、自動完了）
- [x] 検索ページの記録モーダル（ステータス + 評価指定）
- [x] 作品詳細ページ（/works/:id — サイドバー型レイアウト）
- [x] 記録の削除（確認ダイアログ付き）
- [x] Records API CRUD完成（GET/PATCH/DELETE + フィルタ・ソート）

### マイライブラリ
- [x] マイライブラリページ（/library）— PR #23
- [x] 記録一覧表示
- [x] ステータス別フィルタ
- [x] ジャンル別フィルタ
- [x] ソート（更新日、評価、タイトル）
- [x] カバー画像クリック → 作品詳細ページへ遷移
- [x] ページネーション（20件/ページ）
- [x] URLクエリパラメータ同期

### ダッシュボード
- [x] ダッシュボードページ（/dashboard）リニューアル — PR #25
- [x] 進行中リスト表示（ジャンル別クイックアクション）
- [x] ワンクリック「+1話」進捗更新（ジャンル別: +1話/+1巻/観た/読了/クリア）
- [x] グローバルナビゲーションバー（全ページ共通、ユーザーメニュー付き）

### MVP完了 ✓
**フェーズ1の機能実装完了（2026-03-22）。デプロイ準備へ。**
（OAuth認証はフェーズ1.5として後回し）

---

## フェーズ2: 記録の充実

- [ ] 話数ごとの感想・評価（EpisodeReviews）
- [ ] タグ機能（Tags / RecordTags）
- [ ] 再視聴回数の記録
- [ ] 手動での作品登録（検索結果にない作品）
- [ ] ダッシュボード統計サマリー

---

## フェーズ3: コミュニティ

- [ ] 作品ごとのディスカッション掲示板（Discussions）
- [ ] 話数ごとのスレッド
- [ ] コメント機能（Comments）
- [ ] ユーザープロフィール（/users/:id — 公開ページ）

---

## フェーズ4: おすすめ機能

- [ ] ユーザーの記録データに基づく好み分析
- [ ] ジャンル横断のレコメンド
- [ ] 「おすすめの理由」表示

---

## 横断タスク

### ドキュメント
- [x] プロダクト仕様書 — `docs/superpowers/specs/2026-03-20-recolly-design.md`
- [x] ADR 0001〜0011 — `docs/adr/`
- [x] コードレビュー再発防止策 — PR #17

### インフラ・デプロイ
- [x] AWS EC2（Railsサーバー）— PR #26, ADR-0012
- [x] AWS RDS（PostgreSQL）— PR #26
- [x] AWS S3（フロントエンド配信）— PR #26
- [x] AWS CloudFront（CDN + リバースプロキシ）— PR #26
- [x] Terraform（IaC）— PR #26
- [x] 本番環境の環境変数設定（SSM Parameter Store）— PR #26
- [x] HTTPS設定（CloudFrontが自動提供）— PR #26
- [x] 本番用Dockerfile（マルチステージビルド）— PR #26
- [x] 初回デプロイ完了（https://d1libv2nochxfe.cloudfront.net）
- [x] GitHub Secrets設定（CI/CD自動デプロイの有効化）
- [ ] ドメイン取得・DNS設定
