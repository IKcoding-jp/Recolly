# EC2 swapメモリ追加設計

## 背景

### 問題

デプロイ時にEC2（t2.micro、メモリ1GB）がフリーズしてSSH/SSMともに応答不能になった。

### 原因

デプロイ中に以下が同時にメモリを消費し、1GBを超過した：

1. 稼働中の `recolly-api` コンテナ（Rails + Puma + Solid Queue）
2. `docker pull` で新しいイメージをダウンロード
3. `docker run --rm ... db:prepare` でDB準備用の一時コンテナ

### 要件

- デプロイ中のダウンタイムは発生させない（旧コンテナの事前停止は不可）
- コスト増加なしで対応する
- Terraformで管理し、インスタンス再構築時も自動設定される

## 設計

### 概要

EC2インスタンスに2GBのswapファイルを追加する。

- swap容量: 2GB（RAMの2倍、AWS推奨値）
- 合計利用可能メモリ: RAM 1GB + swap 2GB = 3GB
- swapは `/swapfile` にファイルとして作成
- `/etc/fstab` に登録し、再起動時も自動有効化

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `infra/ec2.tf` | `user_data` にswap設定スクリプトを追加 |

### user_data スクリプト

```bash
#!/bin/bash
# swapファイルの作成（2GB）
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
```

### 反映方法

1. `terraform apply` で `user_data` を更新
2. 既存インスタンスには即時反映されないため、手動でも同じコマンドを実行
3. 次回インスタンス再構築時は自動で設定される

### テスト方法

```bash
# swap有効化の確認
free -h
# swapの行に 2.0G が表示されれば成功

# swapfileの確認
swapon --show
```
