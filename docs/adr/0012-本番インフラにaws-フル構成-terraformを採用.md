# ADR-0012: 本番インフラにAWS フル構成 + Terraformを採用

## ステータス
承認済み

## 背景
フェーズ1（MVP）完成後、本番環境をどの方式でデプロイするか。
プロジェクトオーナーはフルスタックエンジニア志望で、AWSの実務経験を積むことも目的の1つ。

## 選択肢
1. **PaaS（Render / Railway）** — git push でデプロイ完了。月$0〜7。構築10分。AWS経験にならない
2. **AWS Lightsail** — AWSの簡易版。月$10〜20。AWS経験は得られるが深さは限定的
3. **AWS フル構成（EC2 + RDS + S3 + CloudFront）+ Terraform** — VPC・IAM等を自分で構築。12ヶ月無料枠あり。インフラの深い理解が得られる

## 決定
**AWS フル構成 + Terraform**を採用する。

## 理由
- フルスタックエンジニア志望のポートフォリオとして、インフラ構築経験が差別化要因になる
- 転職先候補の企業がAWSを使用しており、実務レベルのAWS経験を積める
- AI駆動開発（Claude Code）でTerraformコードを生成するため、学習コストは抑えられる
- AWSアカウント新規作成のため、12ヶ月無料枠で実質コストゼロ
- Terraformにより全インフラをコード管理でき、既存のSDD + TDDワークフローと統合可能
- PaaS（Render等）では「git pushしました」で終わり、面接での会話が広がらない
- 将来ECS/Fargate等への移行も、Docker + Terraform構成なら自然に拡張できる

## 補足
- Redis（キャッシュ）はMVP段階ではmemory_storeを使用し、ElastiCacheは将来の拡張とする（コスト削減）
- ドメイン・DNS設定は後から追加可能な設計とする
