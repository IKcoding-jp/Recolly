# frozen_string_literal: true

# AniListからの作品データ同期サービス
# オンデマンド（作品詳細ページ表示時）と週次バッチで使用
class AniListSyncService
  ENDPOINT = 'https://graphql.anilist.co'
  SYNC_INTERVAL = 24.hours

  QUERY = <<~GRAPHQL
    query ($id: Int) {
      Media(id: $id) {
        id
        volumes
        episodes
        chapters
        status
      }
    }
  GRAPHQL

  def sync_work(work)
    return unless work.external_api_source == 'anilist'
    return if work.external_api_id.blank?

    data = fetch_from_anilist(work.external_api_id.to_i)
    return unless data

    new_total = work.manga? ? data['volumes'] : data['episodes']
    work.update!(
      total_episodes: new_total || work.total_episodes,
      metadata: work.metadata.merge('status' => data['status']),
      last_synced_at: Time.current
    )
  end

  def needs_sync?(work)
    work.last_synced_at.nil? || work.last_synced_at < SYNC_INTERVAL.ago
  end

  private

  def fetch_from_anilist(anilist_id)
    response = connection.post('/', { query: QUERY, variables: { id: anilist_id } })
    response.body.dig('data', 'Media')
  rescue Faraday::Error => e
    Rails.logger.error("[AnilistSyncService] API通信エラー: #{e.message}")
    nil
  end

  def connection
    @connection ||= Faraday.new(url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end
end
