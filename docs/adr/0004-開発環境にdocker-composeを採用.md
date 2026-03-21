# ADR-0004: 開発環境にDocker Composeを採用

## ステータス
承認済み

## 背景
Recollyはバックエンド（Rails）、フロントエンド（React）、データベース（PostgreSQL）の3つのサービスで構成される。開発環境でこれら全てを起動・管理する仕組みが必要。また、開発環境はWindows 11上に構築する。

## 選択肢

### A案: Docker Compose
- **これは何か:** 複数のアプリケーション（Rails、React、PostgreSQL等）を「コンテナ」という隔離された箱に入れて、`docker compose up` の1コマンドでまとめて起動できるツール。コンテナは「アプリごとの小さな仮想マシン」のようなもの。
- **長所:**
  - 1コマンドで全サービスを起動できる
  - 環境の再現性が高い（「自分のPCでは動く」問題が起きにくい）
  - PostgreSQLをインストールせずにコンテナとして使える
  - 本番環境（AWS）でもDockerを使うため、開発と本番の差異が小さい
  - docker-compose.ymlにサービス構成が宣言的に記述される
- **短所:**
  - Docker Desktop自体が2〜4GBのメモリを消費する
  - WindowsのDockerはファイル監視（ホットリロード）がネイティブより遅い
  - Dockerの概念（イメージ、コンテナ、ボリューム等）の学習コストがある

### B案: ローカル直接インストール
- **これは何か:** Ruby、Node.js、PostgreSQLをWindowsに直接インストールして、各サービスを個別に起動する方法。
- **長所:**
  - ファイル監視が高速（ホットリロードが速い）
  - Dockerのメモリ消費がない
  - Dockerの概念を覚える必要がない
- **短所:**
  - Ruby、Node.js、PostgreSQLをそれぞれ個別にインストール・バージョン管理する必要がある
  - WindowsへのPostgreSQLインストールは手間がかかる
  - 「自分のPCでは動く」問題が起きやすい
  - 本番環境との差異が大きくなる

### C案: WSL2 + ローカルインストール
- **これは何か:** Windows上でLinux環境を動かすWSL2（Windows Subsystem for Linux）を使い、Linux上にRuby、Node.js、PostgreSQLをインストールする方法。
- **長所:**
  - Linux環境なので、本番（AWS Linux）との差異が小さい
  - Dockerより軽量
  - Linuxの開発ツールがそのまま使える
- **短所:**
  - WSL2自体のセットアップが必要
  - Windows側のファイルとWSL側のファイルで混乱しやすい
  - PostgreSQLはやはり個別インストールが必要

## 決定
A案: Docker Composeを採用する。

## 理由
1. 1コマンドで全サービスを起動でき、セットアップの手間が最小限
2. PostgreSQLをWindowsにインストールする必要がない（コンテナとして提供）
3. 本番環境（AWS）でもDockerを使う予定のため、開発と本番の差異を小さくできる
4. docker-compose.ymlでサービス構成が明文化され、環境の再現性が担保される

ファイル監視の遅さは `usePolling: true`（Vite設定）で対策済み。メモリ消費はPCスペックに余裕があれば問題ない。

## 影響
- 開発には Docker Desktop for Windows が必須
- 全サービスの起動は `docker compose up` で行う
- サービス構成は `docker-compose.yml` に定義
- Gemのキャッシュは `bundle_cache` ボリュームで永続化
- Git hooks（lefthook）はDocker内でlint/testを実行するため、コミット時にDockerが起動している必要がある
