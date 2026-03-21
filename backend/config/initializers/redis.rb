# frozen_string_literal: true

# Redis接続（検索キャッシュ等で使用、ADR-0008）
REDIS = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
