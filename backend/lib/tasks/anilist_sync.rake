# frozen_string_literal: true

namespace :anilist do
  desc '全漫画作品のAniListデータを一括同期する（週次バッチ用）'
  task sync_manga: :environment do
    works = Work.where(media_type: :manga, external_api_source: 'anilist')
                .where.not(external_api_id: nil)
    total = works.count
    synced = 0
    errors = 0

    puts "#{total} 件の漫画作品を同期します..."

    service = AniListSyncService.new
    works.find_each do |work|
      service.sync_work(work)
      synced += 1
      # AniListのレートリミット対策（90リクエスト/分 → 1秒間隔）
      sleep 1
    rescue StandardError => e
      errors += 1
      Rails.logger.error("[anilist:sync_manga] #{work.title}(ID:#{work.id}) 同期エラー: #{e.message}")
    end

    puts "同期完了: 成功 #{synced} 件 / エラー #{errors} 件"
  end

  desc '既存の漫画作品をAniListから volumes を再取得して更新する（1回限り）'
  task migrate_manga_to_volumes: :environment do
    works = Work.where(media_type: :manga, external_api_source: 'anilist')
                .where.not(external_api_id: nil)
    total = works.count
    updated = 0
    errors = 0

    puts "#{total} 件の漫画作品の total_episodes を volumes に移行します..."

    service = AniListSyncService.new
    works.find_each do |work|
      old_value = work.total_episodes
      service.sync_work(work)
      work.reload
      if work.total_episodes != old_value
        updated += 1
        puts "  #{work.title}: #{old_value} → #{work.total_episodes}"
      end
      sleep 1
    rescue StandardError => e
      errors += 1
      Rails.logger.error("[migrate_manga_to_volumes] #{work.title}(ID:#{work.id}) エラー: #{e.message}")
    end

    puts "移行完了: 更新 #{updated} 件 / エラー #{errors} 件 / 全 #{total} 件"
  end
end
