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

  describe '#enrich_covers' do
    let(:openbd_double) { instance_double(ExternalApis::OpenbdClient) }

    before do
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(openbd_double)
      allow(openbd_double).to receive(:fetch).and_return({ cover_image_url: 'https://c.jpg', description: '名作。' })
    end

    it '画像欠損の本の書影をopenBDで補完する' do
      book = build_book_result('9784101001340')
      service.enrich_covers([book])

      expect(book.cover_image_url).to eq('https://c.jpg')
    end

    it '説明補完のHTTPリクエスト（TMDB・Wikipedia）は行わない（ADR-0044: 説明は記録時補完）' do
      results = [build_result('作品A'), build_book_result('9784101001340')]
      service.enrich_covers(results)

      expect(tmdb_double).not_to have_received(:fetch_japanese_description)
      expect(wiki_double).not_to have_received(:search_and_fetch_extract)
    end

    it 'limit 件目までのみ補完対象にする' do
      books = [build_book_result('9784101001340'), build_book_result('9784101001357')]
      service.enrich_covers(books, limit: 1)

      expect(openbd_double).to have_received(:fetch).once
    end

    context 'キャッシュ' do
      let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

      before do
        allow(Rails).to receive(:cache).and_return(memory_store)
      end

      it 'openBDの書誌データをISBN単位でキャッシュし、2回目は外部APIを呼ばない' do
        service.enrich_covers([build_book_result('9784101001340')])
        book2 = build_book_result('9784101001340')
        service.enrich_covers([book2])

        expect(book2.cover_image_url).to eq('https://c.jpg')
        expect(openbd_double).to have_received(:fetch).once
      end
    end
  end

  describe '#enrich_work_description!' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before do
      allow(Rails).to receive(:cache).and_return(memory_store)
    end

    def create_work(description: nil, metadata: {})
      Work.create!(
        title: '葬送のフリーレン', media_type: 'anime', description: description,
        external_api_id: '1', external_api_source: 'anilist', metadata: metadata
      )
    end

    it '説明が空のWorkに日本語説明を取得して保存する' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return('魔王討伐後の物語。')
      work = create_work

      service.enrich_work_description!(work)

      expect(work.reload.description).to eq('魔王討伐後の物語。')
    end

    it '英語説明のWorkを日本語説明で上書きする' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return('魔王討伐後の物語。')
      work = create_work(description: 'A story after defeating the Demon King.')

      service.enrich_work_description!(work)

      expect(work.reload.description).to eq('魔王討伐後の物語。')
    end

    it '既に日本語説明があるWorkは外部APIを呼ばない' do
      work = create_work(description: '魔王討伐後の物語。')

      service.enrich_work_description!(work)

      expect(tmdb_double).not_to have_received(:fetch_japanese_description)
      expect(work.reload.description).to eq('魔王討伐後の物語。')
    end

    it 'metadataの英語タイトル（jsonb文字列キー）でもTMDB検索を試みる' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return(nil)
      allow(tmdb_double).to receive(:fetch_japanese_description).with('Frieren').and_return('魔王討伐後の物語。')
      work = create_work(metadata: { 'title_english' => 'Frieren' })

      service.enrich_work_description!(work)

      expect(work.reload.description).to eq('魔王討伐後の物語。')
    end

    it 'タイトル単位キャッシュにヒットしたら外部APIを呼ばずに保存する' do
      # 検索補完時代と同じキー体系（media_type + 正規化タイトル）を共有する
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return('魔王討伐後の物語。')
      service.enrich_work_description!(create_work)

      second = Work.create!(
        title: '葬送のフリーレン ', media_type: 'anime',
        external_api_id: '2', external_api_source: 'anilist'
      )
      service.enrich_work_description!(second)

      expect(second.reload.description).to eq('魔王討伐後の物語。')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('葬送のフリーレン').once
    end

    it 'ネガティブキャッシュ（NOT_FOUND）ヒット時は再試行せず既存説明を保持する' do
      work = create_work(description: 'English description here.')
      service.enrich_work_description!(work) # NOT_FOUND がキャッシュされる

      allow(tmdb_double).to receive(:fetch_japanese_description).and_return('後から見つかった説明。')
      second = Work.create!(
        title: '葬送のフリーレン', media_type: 'anime', description: 'English description here.',
        external_api_id: '3', external_api_source: 'anilist'
      )
      service.enrich_work_description!(second)

      expect(second.reload.description).to eq('English description here.')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('葬送のフリーレン').once
    end

    it '日本語説明が見つからなくても既存の説明を消さない' do
      work = create_work(description: 'English description here.')

      service.enrich_work_description!(work)

      expect(work.reload.description).to eq('English description here.')
    end

    it '外部APIが例外を投げても例外を漏らさずWorkを変更しない' do
      allow(tmdb_double).to receive(:fetch_japanese_description).and_raise(StandardError, 'boom')
      work = create_work(description: 'English description here.')

      expect { service.enrich_work_description!(work) }.not_to raise_error
      expect(work.reload.description).to eq('English description here.')
    end
  end
end
