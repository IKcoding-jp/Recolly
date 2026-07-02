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

  def build_book_result(isbn)
    ExternalApis::BaseAdapter::SearchResult.new(
      '人間失格', 'book', nil, nil, nil, 'g1', 'google_books', { isbn: isbn, popularity: 0.5 }
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

  describe '補完キャッシュ' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before do
      allow(Rails).to receive(:cache).and_return(memory_store)
    end

    it '取得した日本語説明をタイトル単位でキャッシュし、2回目は外部APIを呼ばない' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return('魔王討伐後の物語。')

      first = build_result('葬送のフリーレン')
      service.enrich([first])
      second = build_result('葬送のフリーレン')
      service.enrich([second])

      expect(second.description).to eq('魔王討伐後の物語。')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('葬送のフリーレン').once
    end

    it 'タイトルの表記揺れ（末尾空白・大文字小文字）でも同じキャッシュにヒットする' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('STEINS;GATE').and_return('タイムリープSF。')

      service.enrich([build_result('STEINS;GATE')])
      second = build_result('steins;gate ')
      service.enrich([second])

      expect(second.description).to eq('タイムリープSF。')
      expect(tmdb_double).to have_received(:fetch_japanese_description).once
    end

    it '説明が見つからなかった事実もキャッシュし、2回目は再試行しない（ネガティブキャッシュ）' do
      service.enrich([build_result('無名の作品')])
      service.enrich([build_result('無名の作品')])

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('無名の作品').once
      expect(wiki_double).to have_received(:search_and_fetch_extract).with('無名の作品').once
    end

    it 'ネガティブキャッシュヒット時は既存の説明を保持する' do
      service.enrich([build_result('無名の作品')]) # NOT_FOUND がキャッシュされる

      # NOT_FOUND キャッシュが効いていれば、ここで日本語説明が見つかるようにしても
      # 外部APIは呼ばれず上書きされないはず（キャッシュが壊れていればこの説明で上書きされてしまう）
      allow(tmdb_double).to receive(:fetch_japanese_description).with('無名の作品').and_return('後から見つかった説明。')
      second = build_result('無名の作品', description: 'English description here.')
      service.enrich([second])

      expect(second.description).to eq('English description here.')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('無名の作品').once
    end

    it 'openBDの書誌データをISBN単位でキャッシュし、2回目は外部APIを呼ばない' do
      openbd_double = instance_double(ExternalApis::OpenbdClient)
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(openbd_double)
      allow(openbd_double).to receive(:fetch).with('9784101001340')
                                             .and_return({ cover_image_url: 'https://c.jpg', description: '名作。' })

      service.enrich([build_book_result('9784101001340')])
      book2 = build_book_result('9784101001340')
      service.enrich([book2])

      expect(book2.cover_image_url).to eq('https://c.jpg')
      expect(openbd_double).to have_received(:fetch).once
    end
  end
end
