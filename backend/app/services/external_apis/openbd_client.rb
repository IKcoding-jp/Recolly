# frozen_string_literal: true

module ExternalApis
  # openBDから書誌データを取得するクライアント
  # https://openbd.jp/
  # APIキー不要・無料・ISBNベースで書誌情報と書影を提供する日本書籍データベース
  # WorkSearchService#enrich_books_via_openbd から使用される
  class OpenbdClient
    BASE_URL = 'https://api.openbd.jp'
    ENDPOINT_PATH = '/v1/get'
    USER_AGENT = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'

    # ISBN から書誌データを取得する
    # 戻り値: { cover_image_url: String|nil, description: String|nil } または nil
    def fetch(isbn)
      return nil if isbn.blank?

      response = connection.get(ENDPOINT_PATH, { isbn: isbn })
      data = response.body&.first
      return nil if data.nil?

      {
        cover_image_url: extract_cover_url(data),
        description: extract_description(data)
      }
    rescue Faraday::Error => e
      Rails.logger.error("[OpenbdClient] 取得エラー: #{e.message}")
      nil
    end

    private

    # openBDレスポンス構造: summary.cover に画像URL（文字列）
    def extract_cover_url(data)
      data.dig('summary', 'cover').presence
    end

    # openBDレスポンス構造: onix.CollateralDetail.TextContent は配列
    # TextType='03' は内容紹介（書籍紹介文）を意味する
    def extract_description(data)
      text_contents = data.dig('onix', 'CollateralDetail', 'TextContent') || []
      intro = text_contents.find { |t| t['TextType'] == '03' }
      intro&.dig('Text').presence
    end

    def connection
      @connection ||= Faraday.new(
        url: BASE_URL, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = USER_AGENT
        f.adapter Faraday.default_adapter
      end
    end
  end
end
