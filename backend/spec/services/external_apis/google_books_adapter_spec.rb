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
  end
end
