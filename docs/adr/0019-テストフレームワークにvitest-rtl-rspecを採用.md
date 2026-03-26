# ADR-0019: テストフレームワークにVitest + RTL / RSpecを採用

## ステータス
承認済み

## 背景
Recollyのフロントエンド（React + TypeScript）とバックエンド（Rails API）の両方にテストを書く必要がある。テストフレームワークの選定が必要。

## 選択肢

### フロントエンド

#### A案: Vitest + React Testing Library（採用）
- **これは何か:** VitestはViteに統合されたテストランナー。React Testing Library（RTL）は「ユーザーの視点でコンポーネントをテストする」ライブラリ。ボタンをクリックしたら何が起きるか、フォームに入力したら何が表示されるか、をテストする
- **長所:** Vite（ADR-0018）と設定を共有でき追加設定が最小。Jestとほぼ同じ書き方ができる。RTLはReact公式推奨で、実装の詳細に依存しないテストが書ける（リファクタリングしてもテストが壊れにくい）
- **短所:** Jestより歴史が浅く情報がやや少ない

#### B案: Jest + React Testing Library
- **これは何か:** JestはMeta（Facebook）製のテストランナー。長年Reactテストのデファクトだった
- **長所:** 最も情報が多い。エコシステムが成熟
- **短所:** Viteとの統合に追加設定（babel, jest.config等）が必要。ESM（JavaScriptの新しいモジュール形式）対応が不完全。Vite環境ではVitestの方が自然

#### C案: Jest + Enzyme
- **これは何か:** EnzymeはAirbnb製のReactテストライブラリ。コンポーネントの内部状態を直接テストできる
- **長所:** 内部実装の詳細なテストが可能
- **短所:** 2023年にメンテナンス終了。React 18以降に非対応。内部実装に依存したテストは壊れやすい

### バックエンド

#### A案: RSpec（採用）
- **これは何か:** Ruby/Railsで最も使われるテストフレームワーク。`describe`/`context`/`it`という自然言語に近い書き方でテストを記述する
- **長所:** Railsコミュニティのデファクトスタンダード。情報量が圧倒的に多い。request spec、model spec等のRails専用機能が充実。DSL（専用の書き方）が読みやすい
- **短所:** Rails標準のMinitestと比べて初期設定がやや多い

#### B案: Minitest
- **これは何か:** Rails標準のテストフレームワーク。Railsに最初から入っている。追加gem不要
- **長所:** 追加gem不要。Rubyの標準的な書き方で書ける。シンプル
- **短所:** RSpecほど表現力のあるDSLがない。Railsコミュニティでは少数派で情報が少ない

## 決定
フロントエンドはA案（Vitest + RTL）、バックエンドはA案（RSpec）を採用。

### フロントエンド構成
- **Vitest 4.1.0:** テストランナー。vite.config.ts内に設定を記述（`globals: true`, `environment: 'jsdom'`）
- **@testing-library/react 16.3.2:** コンポーネントのレンダリング・操作
- **@testing-library/user-event 14.6.1:** クリック・入力等のユーザー操作シミュレーション
- **@testing-library/jest-dom 6.9.1:** DOM用のマッチャー（`toBeInTheDocument()`等）
- **jsdom 29.0.1:** ブラウザ環境のエミュレーション

### バックエンド構成
- **rspec-rails 7.0:** テストフレームワーク（model spec, request spec）
- **webmock:** 外部APIリクエストのモック（Faradayテスト用）
- **Devise::Test::IntegrationHelpers:** 認証テスト用ヘルパー（`sign_in`等）
- **OmniAuth テストモード:** OAuthテスト用モック

## 理由
- **Vitest:** Viteをビルドツールに採用（ADR-0018）しているので、設定を共有できるVitestが最も自然な選択。`vite.config.ts`にtest設定を追加するだけで動く。Jestだと別途設定ファイルが必要
- **RTL:** React公式推奨のテストライブラリ。「ユーザーがボタンをクリックしたらどうなるか」という視点でテストするため、コンポーネント内部の実装を変えてもテストが壊れにくい
- **RSpec:** Railsコミュニティのデファクトスタンダードで情報量が圧倒的に多い。`describe`/`context`/`it`の構造が自然言語に近く読みやすい
- 全体として、各技術スタックの**公式推奨・デファクトスタンダード**を選んだ判断。奇をてらわず、最も情報が多く自然な選択を取った

## 影響
- フロントエンドのテストはVitestの設定（`vite.config.ts`のtestセクション）に依存。Viteから別のビルドツールに移行する場合はテスト設定も変更が必要
- バックエンドのテストはRSpecの規約（`spec/`ディレクトリ、`*_spec.rb`ファイル名）に従う
- 外部APIテストはwebmockでHTTPリクエストをモック。テスト中に実際の外部API通信は発生しない
