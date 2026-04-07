# EC2 swapメモリ追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EC2（t2.micro）にswapメモリ2GBを追加し、デプロイ時のメモリ不足によるフリーズを防止する

**Architecture:** 既存の `infra/scripts/user_data.sh`（EC2起動時に自動実行されるスクリプト）にswapファイル作成コマンドを追加する。既存インスタンスには手動で同じコマンドを実行して即時反映する。

**Tech Stack:** Terraform / Bash / AWS EC2

---

### Task 1: user_data.sh にswap設定を追加

**Files:**
- Modify: `infra/scripts/user_data.sh`

- [ ] **Step 1: user_data.sh にswapファイル作成スクリプトを追加**

`infra/scripts/user_data.sh` の末尾に以下を追加する:

```bash
# swapメモリの設定（2GB）
# t2.micro（RAM 1GB）のメモリ不足を補うため。
# デプロイ時のdocker pull + db:prepare + 旧コンテナ同時実行でメモリが不足する問題の対策。
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
```

- [ ] **Step 2: コミット**

```bash
git add infra/scripts/user_data.sh
git commit -m "feat: EC2のuser_dataにswapメモリ設定を追加"
```

### Task 2: 既存EC2インスタンスにswapを手動設定

**Files:** なし（EC2上での手動操作）

- [ ] **Step 1: EC2にSSH接続**

```bash
ssh -i ~/.ssh/recolly-ec2 ec2-user@<EC2_PUBLIC_IP>
```

- [ ] **Step 2: swapが既に存在しないか確認**

```bash
ssh -i ~/.ssh/recolly-ec2 ec2-user@<EC2_PUBLIC_IP> "free -h && swapon --show"
```

期待結果: Swapの行が `0B` で、`swapon --show` の出力が空（swapなし）

- [ ] **Step 3: swapファイルを作成・有効化**

```bash
ssh -i ~/.ssh/recolly-ec2 ec2-user@<EC2_PUBLIC_IP> "sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab"
```

- [ ] **Step 4: swap有効化を確認**

```bash
ssh -i ~/.ssh/recolly-ec2 ec2-user@<EC2_PUBLIC_IP> "free -h && swapon --show"
```

期待結果:
- `free -h` のSwap行に `2.0Gi` が表示される
- `swapon --show` に `/swapfile` が表示される

### Task 3: ドキュメント・ADRをコミット

**Files:**
- 新規: `docs/superpowers/specs/2026-04-07-ec2-swap-memory-design.md`（作成済み）
- Modify: `docs/adr/0028-aws詳細アーキテクチャの構成判断.md`（更新済み）

- [ ] **Step 1: ドキュメントをコミット**

```bash
git add docs/superpowers/specs/2026-04-07-ec2-swap-memory-design.md "docs/adr/0028-aws詳細アーキテクチャの構成判断.md"
git commit -m "docs: EC2 swapメモリ追加の設計書とADR更新"
```

### Task 4: PR作成・マージ

- [ ] **Step 1: ブランチを作成してプッシュ**

```bash
git checkout -b feat/ec2-swap-memory
git push -u origin feat/ec2-swap-memory
```

注意: Task 1, 3 のコミットはこのブランチ上で行うこと。

- [ ] **Step 2: PR作成**

```bash
gh pr create --title "feat: EC2にswapメモリ2GBを追加" --body "..."
```

- [ ] **Step 3: CIパス・レビュー後にマージ**
