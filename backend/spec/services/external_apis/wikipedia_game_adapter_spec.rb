# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::WikipediaGameAdapter, type: :service do
  subject(:adapter) { described_class.new }

  describe '#search_titles' do
    let(:search_response) do
      {
        'query' => {
          'search' => [
            { 'title' => '星のカービィ スーパーデラックス', 'snippet' => 'ゲームソフト' },
            { 'title' => '星のカービィ Wii', 'snippet' => 'アクションゲーム' },
            { 'title' => '星のカービィ (アニメ)', 'snippet' => 'テレビアニメ' }
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
      titles = adapter.search_titles('カービィ')
      expect(titles).to include('星のカービィ スーパーデラックス')
      expect(titles).to include('星のカービィ Wii')
    end

    it '最大10件のタイトルを返す' do
      titles = adapter.search_titles('カービィ')
      expect(titles.length).to be <= 10
    end
  end

  describe '#fetch_extract' do
    let(:extract_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => '星のカービィ スーパーデラックス',
              'extract' => '星のカービィ スーパーデラックスは、1996年に任天堂が発売したスーパーファミコン用アクションゲーム。'
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
      extract = adapter.fetch_extract('星のカービィ スーパーデラックス')
      expect(extract).to include('1996年')
      expect(extract).to include('アクションゲーム')
    end

    it '記事が存在しない場合はnilを返す' do
      not_found = { 'query' => { 'pages' => { '-1' => { 'missing' => '' } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: not_found.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_extract('存在しないページ')).to be_nil
    end
  end

  describe '#fetch_english_title' do
    let(:langlink_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => '星のカービィ スーパーデラックス',
              'langlinks' => [{ 'lang' => 'en', '*' => 'Kirby Super Star' }]
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
      en_title = adapter.fetch_english_title('星のカービィ スーパーデラックス')
      expect(en_title).to eq('Kirby Super Star')
    end

    it '英語版記事がない場合はnilを返す' do
      no_langlink = { 'query' => { 'pages' => { '99' => { 'title' => 'テスト', 'langlinks' => [] } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: no_langlink.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_english_title('日本語のみの記事')).to be_nil
    end
  end

  describe 'エラーハンドリング' do
    it 'API通信エラー時にsearch_titlesは空配列を返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(adapter.search_titles('テスト')).to eq([])
    end

    it 'API通信エラー時にfetch_extractはnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(adapter.fetch_extract('テスト')).to be_nil
    end
  end
end
