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
    # media_type: 呼び出し元が指定したジャンル（AniListのtype絞り込み等に使用）
    def search(query, media_type: nil)
      raise NotImplementedError, "#{self.class}#search を実装してください"
    end

    # エラーハンドリング付き検索（コントローラーから呼ぶ）
    def safe_search(query, media_type: nil)
      search(query, media_type: media_type)
    rescue Faraday::Error => e
      Rails.logger.error("[#{self.class.name}] API通信エラー: #{e.message}")
      []
    rescue StandardError => e
      Rails.logger.error("[#{self.class.name}] 予期せぬエラー: #{e.message}")
      []
    end

    private

    # タイムアウト例外はデフォルトでリトライしない（5xxのリトライは維持）
    # 相手APIが詰まっている時のタイムアウトはリトライしても失敗し、待ち時間が実質2〜3倍になるだけのため
    # （検索全体が30秒超になる実害があった。Faraday::RetriableResponseは
    #  retry_statusesベースのリトライに必須のため必ず残す）
    def connection(url:, open_timeout: 5, timeout: 10, retry_on_timeout: false)
      Faraday.new(url: url, request: { open_timeout: open_timeout, timeout: timeout }) do |f|
        f.request :json
        # POSTも含める（AniList GraphQL等の検索クエリは冪等のため安全）
        retry_options = { max: 2, retry_statuses: [500, 502, 503, 504],
                          methods: %i[get head options put delete post] }
        retry_options[:exceptions] = [Faraday::RetriableResponse] unless retry_on_timeout
        f.request :retry, retry_options
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
  end
end
