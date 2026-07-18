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

    describe '漫画・ラノベの除外' do
      # 漫画・ラノベはAniList由来の「漫画・ラノベ」ジャンルでシリーズ単位に管理するため、
      # Google Booksの単巻レコード（Comics & Graphic Novels / Young Adult Fiction）は本の検索から除外する
      def build_item(id:, title:, categories: nil)
        volume_info = { 'title' => title }
        volume_info['categories'] = categories if categories
        { 'id' => id, 'volumeInfo' => volume_info }
      end

      it 'categories に Comics & Graphic Novels を含む結果は除外する' do
        stub_books_response([
                              build_item(id: 'm1', title: '恋するワンピース 1',
                                         categories: ['Comics & Graphic Novels']),
                              build_item(id: 'b1', title: 'ワンピースの縫い方')
                            ])
        titles = adapter.search('ワンピース').map(&:title)
        expect(titles).not_to include('恋するワンピース 1')
        expect(titles).to include('ワンピースの縫い方')
      end

      it 'categories に Young Adult Fiction（ラノベ）を含む結果は除外する' do
        stub_books_response([
                              build_item(id: 'ln1', title: 'ソードアート・オンライン1',
                                         categories: ['Young Adult Fiction']),
                              build_item(id: 'b1', title: '普通の小説', categories: ['Fiction'])
                            ])
        titles = adapter.search('ソードアート・オンライン').map(&:title)
        expect(titles).not_to include('ソードアート・オンライン1')
        expect(titles).to include('普通の小説')
      end

      it 'categories が無い結果は除外しない' do
        stub_books_response([build_item(id: 'b2', title: '分類なしの本')])
        expect(adapter.search('分類なしの本').map(&:title)).to include('分類なしの本')
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
      # HTTPS ページで Mixed Content としてブロックされるため https:// に正規化する。
      # また素のthumbnailは128px幅しかないため fife=w400 で400px幅を要求する
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
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&img=1&fife=w400')
      end

      it '既に https:// の thumbnail URL はプロトコルを変えない' do
        stub_books_response([build_book_item(
          thumbnail: 'https://books.google.com/books/content?id=abc123'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&fife=w400')
      end

      it '低解像度画像用の edge=curl パラメータを除去する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?id=abc123&zoom=1&edge=curl&source=gbs_api'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&zoom=1&source=gbs_api&fife=w400')
      end

      it 'fife=w400 を付与して高解像度画像を要求する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?id=abc123&zoom=1'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to include('fife=w400')
      end

      it 'thumbnail が nil の場合は nil のままエラーにしない' do
        stub_books_response([{
                              'id' => 'abc123',
                              'volumeInfo' => { 'title' => 'テスト本' }
                            }])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to be_nil
      end

      it 'thumbnail が空文字列の場合は nil を返す（ゴミURLを生成しない）' do
        stub_books_response([build_book_item(thumbnail: '')])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to be_nil
      end

      it 'edge=curl が唯一のクエリパラメータでも除去する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?edge=curl'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?fife=w400')
      end

      it 'edge=curl が先頭のクエリパラメータでも除去する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?edge=curl&id=abc123'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&fife=w400')
      end
    end
  end
end
