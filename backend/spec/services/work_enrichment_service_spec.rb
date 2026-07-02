# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WorkEnrichmentService, type: :service do
  subject(:service) { described_class.new }

  let(:tmdb_double) { instance_double(ExternalApis::TmdbAdapter, fetch_japanese_description: nil) }
  let(:wiki_double) { instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil) }

  before do
    allow(ExternalApis::TmdbAdapter).to receive(:new).and_return(tmdb_double)
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
  end

  def build_result(title, description: nil)
    ExternalApis::BaseAdapter::SearchResult.new(
      title, 'anime', description, nil, nil, title, 'anilist', { popularity: 0.5 }
    )
  end

  describe '#enrich の limit' do
    it 'limit 件目までのみ説明補完のHTTPリクエストを行う' do
      results = [build_result('作品A'), build_result('作品B'), build_result('作品C')]
      service.enrich(results, limit: 2)

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品A')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品B')
      expect(tmdb_double).not_to have_received(:fetch_japanese_description).with('作品C')
    end

    it 'limit: nil で全件を補完する' do
      results = [build_result('作品A'), build_result('作品B')]
      service.enrich(results)

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品A')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品B')
    end

    it 'limit 外の結果にもシリーズ親説明の流用は適用される' do
      parent = build_result('進撃の巨人', description: '巨人と戦う話。')
      child = build_result('進撃の巨人 Season 2')
      results = [parent, child]
      service.enrich(results, limit: 1)

      expect(child.description).to eq('巨人と戦う話。')
      expect(child.metadata[:description_from_parent]).to be true
    end
  end
end
