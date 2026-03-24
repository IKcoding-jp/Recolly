# Docker コマンド

```bash
# 全サービス起動
docker compose up

# バックエンドのみ
docker compose up backend

# テスト実行
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec
docker compose run --rm frontend npm test

# lint実行
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npm run lint

# DB操作
docker compose run --rm backend bin/rails db:create
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm backend bin/rails db:seed
```
