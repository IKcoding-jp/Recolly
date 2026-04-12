# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::WikipediaClient, type: :service do
  subject(:client) { described_class.new }

  describe '#search' do
    let(:search_response) do
      {
        'query' => {
          'search' => [
            { 'title' => 'ゼルダの伝説 ブレス オブ ザ ワイルド', 'snippet' => 'ゲーム' },
            { 'title' => 'ゼルダの伝説 ティアーズ オブ ザ キングダム', 'snippet' => 'ゲーム' },
            { 'title' => 'ゼルダ (ゲームキャラクター)', 'snippet' => 'キャラクター' }
          ]
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: search_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'Wikipediaの検索結果からタイトル一覧を返す' do
      titles = client.search('ゼルダ')
      expect(titles).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダの伝説 ティアーズ オブ ザ キングダム',
        'ゼルダ (ゲームキャラクター)'
      )
    end

    it 'API通信エラー時に空配列を返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.search('テスト')).to eq([])
    end
  end

  describe '#fetch_extract' do
    let(:extract_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => 'けいおん!',
              'extract' => 'けいおん!は、かきふらいによる日本の4コマ漫画作品。'
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: extract_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '記事の冒頭テキストを返す' do
      extract = client.fetch_extract('けいおん!')
      expect(extract).to eq('けいおん!は、かきふらいによる日本の4コマ漫画作品。')
    end

    it '記事が存在しない場合はnilを返す' do
      not_found = { 'query' => { 'pages' => { '-1' => { 'missing' => '' } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: not_found.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(client.fetch_extract('存在しないページ')).to be_nil
    end

    it 'API通信エラー時にnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_extract('テスト')).to be_nil
    end
  end

  describe '#fetch_english_title' do
    let(:langlink_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => 'バイオハザード RE:2',
              'langlinks' => [{ 'lang' => 'en', '*' => 'Resident Evil 2 (2019 video game)' }]
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: langlink_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '日本語Wikipediaの言語間リンクから英語タイトルを返す' do
      en_title = client.fetch_english_title('バイオハザード RE:2')
      expect(en_title).to eq('Resident Evil 2 (2019 video game)')
    end

    it '英語版記事がない場合はnilを返す' do
      no_langlink = { 'query' => { 'pages' => { '99' => { 'title' => 'テスト', 'langlinks' => [] } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: no_langlink.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(client.fetch_english_title('日本語のみの記事')).to be_nil
    end

    it 'API通信エラー時にnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_english_title('テスト')).to be_nil
    end
  end

  describe '#fetch_categories' do
    let(:categories_response) do
      {
        'query' => {
          'pages' => {
            '111' => {
              'title' => 'ゼルダの伝説 ブレス オブ ザ ワイルド',
              'categories' => [
                { 'ns' => 14, 'title' => 'Category:2017年のコンピュータゲーム' },
                { 'ns' => 14, 'title' => 'Category:Nintendo Switchのゲームソフト' }
              ]
            },
            '222' => {
              'title' => 'ゼルダ (ゲームキャラクター)',
              'categories' => [
                { 'ns' => 14, 'title' => 'Category:ゼルダの伝説の登場人物' }
              ]
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: categories_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '複数タイトルのカテゴリをハッシュで返す' do
      result = client.fetch_categories(['ゼルダの伝説 ブレス オブ ザ ワイルド', 'ゼルダ (ゲームキャラクター)'])
      expect(result.keys).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダ (ゲームキャラクター)'
      )
      expect(result['ゼルダの伝説 ブレス オブ ザ ワイルド']).to include('Category:2017年のコンピュータゲーム')
      expect(result['ゼルダ (ゲームキャラクター)']).not_to include(a_string_matching(/ゲームソフト/))
    end

    it 'API通信エラー時に空ハッシュを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_categories(['テスト'])).to eq({})
    end
  end

  describe '#search_and_fetch_extract' do
    context '検索で記事が見つかる場合' do
      before do
        # 1回目: search API（query.list.search）
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(list: 'search'))
          .to_return(status: 200, body: {
            'query' => {
              'search' => [{ 'title' => '呪術廻戦' }]
            }
          }.to_json, headers: { 'Content-Type' => 'application/json' })

        # 2回目: extract API（query.pages）
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(prop: 'extracts'))
          .to_return(status: 200, body: {
            'query' => {
              'pages' => { '1' => { 'title' => '呪術廻戦', 'extract' => '呪術廻戦は芥見下々による日本の漫画作品。' } }
            }
          }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it '検索→概要取得の2段階で日本語説明を返す' do
        extract = client.search_and_fetch_extract('呪術廻戦 第2期')
        expect(extract).to eq('呪術廻戦は芥見下々による日本の漫画作品。')
      end
    end

    context '検索で記事が0件の場合' do
      before do
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(list: 'search'))
          .to_return(status: 200, body: {
            'query' => { 'search' => [] }
          }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it 'nil を返す' do
        expect(client.search_and_fetch_extract('存在しない作品xyz123')).to be_nil
      end
    end

    context 'クエリが空の場合' do
      it 'nil を返しAPI呼び出しは発生しない' do
        expect(client.search_and_fetch_extract('')).to be_nil
        expect(client.search_and_fetch_extract(nil)).to be_nil
        expect(WebMock).not_to have_requested(:get, /ja.wikipedia.org/)
      end
    end
  end
end
