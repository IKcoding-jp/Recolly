# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe AniListSyncService, type: :service do
  let(:service) { described_class.new }

  let(:anilist_response) do
    {
      'data' => {
        'Media' => {
          'id' => 53_390,
          'volumes' => 34,
          'episodes' => nil,
          'chapters' => 139,
          'status' => 'FINISHED'
        }
      }
    }
  end

  before do
    stub_request(:post, 'https://graphql.anilist.co')
      .to_return(status: 200, body: anilist_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#sync_work' do
    let(:work) do
      Work.create!(
        title: '進撃の巨人', media_type: 'manga',
        total_episodes: 139, external_api_id: '53390',
        external_api_source: 'anilist',
        metadata: { 'status' => 'RELEASING' }
      )
    end

    it 'AniListから最新データを取得して更新する' do
      service.sync_work(work)
      work.reload
      expect(work.total_episodes).to eq(34)
      expect(work.metadata['status']).to eq('FINISHED')
    end

    it 'last_synced_at を更新する' do
      service.sync_work(work)
      work.reload
      expect(work.last_synced_at).to be_within(1.second).of(Time.current)
    end

    it 'AniListソースでない作品はスキップする' do
      non_anilist = Work.create!(
        title: '手動作品', media_type: 'manga',
        external_api_source: nil
      )
      expect { service.sync_work(non_anilist) }.not_to(change { non_anilist.reload.last_synced_at })
    end
  end

  describe '#needs_sync?' do
    it 'last_synced_at が nil なら true' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: nil)
      expect(service.needs_sync?(work)).to be true
    end

    it 'last_synced_at が24時間以上前なら true' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: 25.hours.ago)
      expect(service.needs_sync?(work)).to be true
    end

    it 'last_synced_at が24時間以内なら false' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: 23.hours.ago)
      expect(service.needs_sync?(work)).to be false
    end
  end
end
