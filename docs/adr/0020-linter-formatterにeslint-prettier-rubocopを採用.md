# ADR-0020: Linter/FormatterにESLint + Prettier / RuboCopを採用

## ステータス
承認済み

## 背景
コードの品質維持と整形の統一のために、Linter（コードの問題を検出するツール）とFormatter（コードの見た目を統一するツール）を選定する必要がある。フロントエンド（TypeScript/React）とバックエンド（Ruby/Rails）でそれぞれ選定が必要。

## 選択肢

### フロントエンド

#### A案: ESLint + Prettier（採用）
- **これは何か:** ESLintはコードの問題（未使用変数、型エラー等）を検出するLinter。Prettierはコードの見た目（インデント、セミコロン、改行等）を統一するFormatter。2つを組み合わせて使う
- **長所:** TypeScript/Reactのデファクトスタンダード。情報量が圧倒的に多い。ESLintはルールのカスタマイズが柔軟。Prettierは「議論の余地なく統一する」思想でチーム開発に向く
- **短所:** 2つのツールを組み合わせるため設定がやや複雑。ESLintとPrettierのルール競合を避ける設定が必要

#### B案: BiomeJS
- **これは何か:** ESLint + Prettierの機能を1つに統合したツール。Rust製で高速
- **長所:** 設定が1つで済む。ESLint + Prettierより圧倒的に速い。ルール競合の問題がない
- **短所:** 2024年時点ではまだ新しく情報が少ない。ESLintほどプラグインやルールが充実していない。React/TypeScript固有のルールが不足する場合がある

### バックエンド

#### A案: RuboCop（採用）
- **これは何か:** Rubyのデファクト標準のLinter + Formatter。コードの問題検出と整形の両方を1つで担当する
- **長所:** Railsコミュニティのデファクトスタンダード。Lint + Formatが1ツールで完結。rubocop-rails等のRails専用ルールが充実。情報量が多い
- **短所:** デフォルトルールが厳しめで、プロジェクトに合わせたカスタマイズが必要になることがある

#### B案: Standard
- **これは何か:** RuboCopの設定を「議論の余地がないデフォルト」に固定したツール。カスタマイズ不要で使える
- **長所:** 設定不要。「これに従えばいい」の一択。RuboCopの設定で悩む時間がゼロ
- **短所:** カスタマイズ性が低い。プロジェクト固有のルールを追加できない

## 決定
フロントエンドはA案（ESLint + Prettier）、バックエンドはA案（RuboCop）を採用。

## 理由
- いずれも各技術スタックで**最も一般的な選択**。デファクトスタンダードを採用した
- ESLint + Prettierは情報量が多く、困ったときに解決策を見つけやすい
- RuboCopはRails開発の標準ツールで、rubocop-rails等のRails専用ルールで品質を担保できる
- BiomeJSは将来有望だが、現時点ではエコシステムの成熟度でESLint + Prettierに及ばない
- CIワークフロー（ADR-0016）でPR時に自動実行し、コード品質を継続的にチェックする

## 影響
- フロントエンドの全TypeScript/Reactコードは ESLint + Prettier のルールに準拠する
- バックエンドの全Rubyコードは RuboCop のルールに準拠する
- CI（GitHub Actions）でPR時にlint + format checkを自動実行。違反があればCIが失敗する
