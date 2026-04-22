# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::GoogleBooksAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:api_key) { 'test_google_books_key' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOOGLE_BOOKS_API_KEY').and_return(api_key)
  end

  def stub_books_response(items)
    stub_request(:get, %r{www.googleapis.com/books/v1/volumes})
      .to_return(status: 200, body: { 'items' => items }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#media_types' do
    it 'book を返す' do
      expect(adapter.media_types).to eq(%w[book])
    end
  end

  describe '#search' do
    let(:google_response) do
      {
        'items' => [
          {
            'id' => 'abc123',
            'volumeInfo' => {
              'title' => 'ノルウェイの森',
              'authors' => ['村上春樹'],
              'description' => '静かな恋愛小説',
              'imageLinks' => { 'thumbnail' => 'https://books.google.com/books/content?id=abc123' },
              'pageCount' => 298,
              'publishedDate' => '1987-09-04',
              'categories' => ['Fiction']
            }
          }
        ]
      }
    end

    before do
      stub_request(:get, %r{www.googleapis.com/books/v1/volumes})
        .to_return(status: 200, body: google_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '本の基本情報を統一フォーマットで返す' do
      results = adapter.search('ノルウェイの森')
      expect(results.length).to eq(1)
      book = results.first
      expect(book.title).to eq('ノルウェイの森')
      expect(book.media_type).to eq('book')
      expect(book.external_api_id).to eq('abc123')
    end

    it 'APIソースとメタデータを正しく設定する' do
      book = adapter.search('ノルウェイの森').first
      expect(book.external_api_source).to eq('google_books')
      expect(book.metadata[:authors]).to eq(['村上春樹'])
    end

    it '結果がない場合は空配列を返す' do
      stub_request(:get, /www.googleapis.com/)
        .to_return(status: 200, body: { 'totalItems' => 0 }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.search('存在しない本')).to eq([])
    end

    it 'intitle:パラメータでタイトル検索に限定する' do
      adapter.search('三体')
      expect(WebMock).to have_requested(:get, /www.googleapis.com/)
        .with(query: hash_including(q: 'intitle:三体'))
    end

    # langRestrict=ja は特定の日本語クエリで Google Books API が断続的に 503 を返すため送らない。
    # 代わりにレスポンスの volumeInfo.language で日本語書籍のみをクライアント側フィルタする。
    describe '言語フィルタ（langRestrict=ja を使わずコード側で絞り込む）' do
      def build_item(id:, title:, language: nil)
        volume_info = { 'title' => title }
        volume_info['language'] = language if language
        { 'id' => id, 'volumeInfo' => volume_info }
      end

      it 'langRestrict クエリパラメータを送らない' do
        adapter.search('成瀬は天下を取りにいく')
        expect(WebMock).to(have_requested(:get, /www.googleapis.com/)
          .with { |req| req.uri.query.to_s.exclude?('langRestrict') })
      end

      it 'volumeInfo.language が ja の結果は返す' do
        stub_books_response([build_item(id: 'n1', title: '成瀬は天下を取りにいく', language: 'ja')])
        expect(adapter.search('成瀬は天下を取りにいく').map(&:title))
          .to include('成瀬は天下を取りにいく')
      end

      it 'volumeInfo.language が ja 以外の結果は除外する' do
        stub_books_response([
                              build_item(id: 'cn1', title: '奪取天下的少女', language: 'zh-CN'),
                              build_item(id: 'n1', title: '成瀬は天下を取りにいく', language: 'ja')
                            ])
        titles = adapter.search('成瀬は天下を取りにいく').map(&:title)
        expect(titles).to include('成瀬は天下を取りにいく')
        expect(titles).not_to include('奪取天下的少女')
      end
    end

    describe 'ISBN抽出' do
      # テストごとに変わるのは industryIdentifiers のみなので、共通部分をヘルパー化
      def build_book_item(identifiers: nil)
        volume_info = { 'title' => 'テスト本' }
        volume_info['industryIdentifiers'] = identifiers if identifiers
        { 'id' => 'abc123', 'volumeInfo' => volume_info }
      end

      it 'ISBN-13 が最優先でmetadataに入る' do
        stub_books_response([build_book_item(identifiers: [
                                               { 'type' => 'ISBN_10', 'identifier' => '4101001340' },
                                               { 'type' => 'ISBN_13', 'identifier' => '9784101001340' }
                                             ])])
        book = adapter.search('テスト本').first
        expect(book.metadata[:isbn]).to eq('9784101001340')
      end

      it 'ISBN-13 がなければ ISBN-10 を使う' do
        stub_books_response([build_book_item(identifiers: [
                                               { 'type' => 'ISBN_10', 'identifier' => '4101001340' }
                                             ])])
        book = adapter.search('テスト本').first
        expect(book.metadata[:isbn]).to eq('4101001340')
      end

      it 'ISBN情報がなければ :isbn キーは含まれない' do
        stub_books_response([build_book_item])
        book = adapter.search('テスト本').first
        expect(book.metadata).not_to have_key(:isbn)
      end
    end

    describe 'カバー画像URLの正規化' do
      # Google Books API は thumbnail URL を http:// で返すことが多く、
      # HTTPS ページで Mixed Content としてブロックされるため https:// に正規化する
      def build_book_item(thumbnail:)
        {
          'id' => 'abc123',
          'volumeInfo' => {
            'title' => 'テスト本',
            'imageLinks' => { 'thumbnail' => thumbnail }
          }
        }
      end

      it 'http:// で始まる thumbnail URL を https:// に正規化する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?id=abc123&img=1'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to eq('https://books.google.com/books/content?id=abc123&img=1')
      end

      it '既に https:// の thumbnail URL はそのまま保持する（冪等性）' do
        stub_books_response([build_book_item(
          thumbnail: 'https://books.google.com/books/content?id=abc123'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to eq('https://books.google.com/books/content?id=abc123')
      end

      it 'thumbnail が nil の場合は nil のままエラーにしない' do
        stub_books_response([{
                              'id' => 'abc123',
                              'volumeInfo' => { 'title' => 'テスト本' }
                            }])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to be_nil
      end
    end
  end
end
