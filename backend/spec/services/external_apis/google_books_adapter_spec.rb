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

    context 'タイトルフィルタ' do
      it '検索キーワードがタイトルに含まれない結果を除外する' do
        stub_books_response([
                              { 'id' => '1', 'volumeInfo' => { 'title' => '三体', 'description' => 'SF小説' } },
                              { 'id' => '2', 'volumeInfo' => { 'title' => '三体II 黒暗森林', 'description' => '続編' } },
                              { 'id' => '3', 'volumeInfo' => { 'title' => '電離気体の原子・分子過程' } }
                            ])
        results = adapter.search('三体')
        expect(results.map(&:title)).to contain_exactly('三体', '三体II 黒暗森林')
      end

      it '大文字小文字を区別しない' do
        stub_books_response([
                              { 'id' => '1',
                                'volumeInfo' => { 'title' => "Harry Potter and the Philosopher's Stone" } },
                              { 'id' => '2', 'volumeInfo' => { 'title' => 'Unrelated Book' } }
                            ])
        results = adapter.search('harry potter')
        expect(results.length).to eq(1)
      end
    end
  end
end
