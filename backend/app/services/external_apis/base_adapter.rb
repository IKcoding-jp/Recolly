# frozen_string_literal: true

# Faraday 2.x ではリトライミドルウェアを明示的にrequireする必要がある
require 'faraday/retry'

module ExternalApis
  # 外部API共通インターフェース（ADR-0011: アダプタパターン）
  # 各APIアダプタはこのクラスを継承し、search メソッドを実装する
  class BaseAdapter
    # 検索結果の統一フォーマット
    SearchResult = Struct.new(
      :title, :media_type, :description, :cover_image_url,
      :total_episodes, :external_api_id, :external_api_source, :metadata
    )

    # このアダプタが対応するmedia_type一覧
    def media_types
      raise NotImplementedError, "#{self.class}#media_types を実装してください"
    end

    # キーワード検索（子クラスで実装）
    def search(query)
      raise NotImplementedError, "#{self.class}#search を実装してください"
    end

    # エラーハンドリング付き検索（コントローラーから呼ぶ）
    def safe_search(query)
      search(query)
    rescue Faraday::Error => e
      Rails.logger.error("[#{self.class.name}] API通信エラー: #{e.message}")
      []
    rescue StandardError => e
      Rails.logger.error("[#{self.class.name}] 予期せぬエラー: #{e.message}")
      []
    end

    private

    def connection(url:)
      Faraday.new(url: url, request: { open_timeout: 5, timeout: 10 }) do |f|
        f.request :json
        # POSTも含める（AniList GraphQL等の検索クエリは冪等のため安全）
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504],
                          methods: %i[get head options put delete post]
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
  end
end
