# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ExternalApis::WikipediaGameAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:client_double) { instance_double(ExternalApis::WikipediaClient) }

  before do
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(client_double)
  end

  describe '#search_titles' do
    let(:search_titles) do
      ['ゼルダの伝説 ブレス オブ ザ ワイルド', '金熊賞', 'スタジオジブリ',
       'ゼルダの伝説 ティアーズ オブ ザ キングダム', 'ゼルダ (ゲームキャラクター)']
    end
    let(:categories_map) do
      {
        'ゼルダの伝説 ブレス オブ ザ ワイルド' => [
          'Category:2017年のコンピュータゲーム',
          'Category:Nintendo Switchのゲームソフト'
        ],
        '金熊賞' => ['Category:ベルリン国際映画祭', 'Category:映画の賞'],
        'スタジオジブリ' => ['Category:日本のアニメスタジオ'],
        'ゼルダの伝説 ティアーズ オブ ザ キングダム' => [
          'Category:2023年のコンピュータゲーム',
          'Category:Nintendo Switchのゲームソフト'
        ],
        'ゼルダ (ゲームキャラクター)' => ['Category:ゼルダの伝説の登場人物']
      }
    end

    before do
      allow(client_double).to receive_messages(
        search: search_titles, fetch_categories: categories_map
      )
    end

    it 'ゲームカテゴリを持つ記事だけを返す' do
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダの伝説 ティアーズ オブ ザ キングダム'
      )
    end

    it 'ゲーム以外の記事（金熊賞、スタジオジブリ等）を除外する' do
      titles = adapter.search_titles('ゼルダ')
      expect(titles).not_to include('金熊賞', 'スタジオジブリ', 'ゼルダ (ゲームキャラクター)')
    end

    it 'タイトルパターンでも事前フィルタする（テレビアニメ等）' do
      # 「星のカービィ (アニメ)」はNON_GAME_PATTERNSで除外されるため、カテゴリ取得は1件のみ
      allow(client_double).to receive_messages(search: ['星のカービィ (アニメ)', '星のカービィ スーパーデラックス'],
                                               fetch_categories: { '星のカービィ スーパーデラックス' => ['Category:1996年のコンピュータゲーム'] })
      titles = adapter.search_titles('カービィ')
      expect(titles).to eq(['星のカービィ スーパーデラックス'])
    end

    it '検索クエリと完全一致するタイトルを除外する（曖昧さ回避ページ対策）' do
      allow(client_double).to receive_messages(search: %w[ゼルダ ゼルダの伝説],
                                               fetch_categories: { 'ゼルダの伝説' => ['Category:ゲーム作品'] })
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to eq(['ゼルダの伝説'])
    end

    it 'カテゴリ取得でエラーが発生した場合は空配列を返す' do
      allow(client_double).to receive(:fetch_categories).and_return({})
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to eq([])
    end
  end

  describe '#fetch_english_title' do
    it 'WikipediaClientに委譲する' do
      allow(client_double).to receive(:fetch_english_title)
        .with('バイオハザード RE:2').and_return('Resident Evil 2 (2019 video game)')
      expect(adapter.fetch_english_title('バイオハザード RE:2')).to eq('Resident Evil 2 (2019 video game)')
    end
  end

  describe '#fetch_extract' do
    it 'WikipediaClientに委譲する' do
      allow(client_double).to receive(:fetch_extract)
        .with('星のカービィ').and_return('任天堂が発売したアクションゲーム。')
      expect(adapter.fetch_extract('星のカービィ')).to eq('任天堂が発売したアクションゲーム。')
    end
  end
end
