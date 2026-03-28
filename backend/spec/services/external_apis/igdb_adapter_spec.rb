# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::IgdbAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:client_id) { 'test_igdb_client_id' }
  let(:client_secret) { 'test_igdb_client_secret' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('IGDB_CLIENT_ID').and_return(client_id)
    allow(ENV).to receive(:fetch).with('IGDB_CLIENT_SECRET').and_return(client_secret)
    Rails.cache.clear

    # Twitch OAuth トークン取得
    stub_request(:post, 'https://id.twitch.tv/oauth2/token')
      .to_return(status: 200,
                 body: { 'access_token' => 'test_token', 'expires_in' => 5_000_000 }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#media_types' do
    it 'game を返す' do
      expect(adapter.media_types).to eq(%w[game])
    end
  end

  describe '#search' do
    let(:igdb_response) do
      [
        {
          'id' => 1942,
          'name' => 'The Witcher 3: Wild Hunt',
          'summary' => 'オープンワールドRPG',
          'cover' => { 'image_id' => 'co1wyy' },
          'platforms' => [{ 'name' => 'PC' }, { 'name' => 'PlayStation 4' }],
          'genres' => [{ 'name' => 'RPG' }],
          'first_release_date' => 1_431_993_600,
          'total_rating' => 92.5
        }
      ]
    end

    before do
      stub_request(:post, 'https://api.igdb.com/v4/games')
        .to_return(status: 200, body: igdb_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'ゲームの検索結果を統一フォーマットで返す' do
      results = adapter.search('Witcher')
      expect(results.length).to eq(1)
      game = results.first
      expect(game.title).to eq('The Witcher 3: Wild Hunt')
      expect(game.media_type).to eq('game')
      expect(game.external_api_id).to eq('1942')
    end

    it 'APIソースとカバー画像URLを正しく設定する' do
      game = adapter.search('Witcher').first
      expect(game.external_api_source).to eq('igdb')
      expect(game.cover_image_url).to include('images.igdb.com')
    end

    it 'popularity（正規化済みtotal_rating）をmetadataに含める' do
      game = adapter.search('Witcher').first
      expect(game.metadata[:popularity]).to be_within(0.01).of(0.925)
    end

    it 'Twitch OAuth トークンを取得してAPIに送信する' do
      adapter.search('Witcher')
      expect(WebMock).to have_requested(:post, 'https://id.twitch.tv/oauth2/token')
      expect(WebMock).to have_requested(:post, 'https://api.igdb.com/v4/games')
        .with(headers: { 'Authorization' => 'Bearer test_token', 'Client-ID' => client_id })
    end

    context '日本語クエリの場合' do
      let(:keyword_response) do
        [{ 'id' => 2623, 'name' => "Kirby's Dream Land", 'summary' => 'カービィのアクションゲーム',
           'cover' => { 'image_id' => 'co2abc' }, 'total_rating' => 80.0 }]
      end
      let(:pattern_response) do
        [
          { 'id' => 2623, 'name' => "Kirby's Dream Land", 'summary' => 'カービィのアクションゲーム',
            'cover' => { 'image_id' => 'co2abc' }, 'total_rating' => 80.0,
            'alternative_names' => [{ 'name' => '星のカービィ', 'comment' => 'Japanese title' }] },
          { 'id' => 3625, 'name' => 'Kirby Super Star', 'summary' => 'カービィの複合アクション',
            'cover' => { 'image_id' => 'co3def' }, 'total_rating' => 85.0,
            'alternative_names' => [{ 'name' => '星のカービィ スーパーデラックス', 'comment' => 'Japanese title' }] }
        ]
      end

      before do
        # Wikipedia補完はこのコンテキストでは空を返す（別コンテキストでテスト）
        wiki_stub = instance_double(ExternalApis::WikipediaGameAdapter, search_titles: [])
        allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wiki_stub)
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: keyword_response.to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: pattern_response.to_json, headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it 'searchキーワードとパターンマッチの両方で検索してマージする' do
        results = adapter.search('カービィ')
        expect(results.length).to eq(2)
        expect(results.map(&:external_api_id)).to contain_exactly('2623', '3625')
      end

      it '重複するIDは除去される' do
        results = adapter.search('カービィ')
        ids = results.map(&:external_api_id)
        expect(ids.uniq.length).to eq(ids.length)
      end
    end

    context '日本語クエリ + Wikipedia補完' do
      let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

      let(:igdb_wikipedia_match) do
        [
          {
            'id' => 3075,
            'name' => 'Kirby Super Star',
            'summary' => 'A Kirby game',
            'cover' => { 'image_id' => 'co5xyz' },
            'total_rating' => 88.0,
            'alternative_names' => [
              { 'name' => '星のカービィ スーパーデラックス', 'comment' => 'Japanese title' }
            ]
          }
        ]
      end

      before do
        allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
        allow(wikipedia_double).to receive_messages(
          search_titles: ['星のカービィ スーパーデラックス', '星のカービィ (アニメ)'],
          fetch_extract: '任天堂が発売したアクションゲーム。'
        )
        # 言語間リンク: 日本語→英語タイトル
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('星のカービィ スーパーデラックス').and_return('Kirby Super Star')
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('星のカービィ (アニメ)').and_return(nil)

        # 1回目: search_by_keyword（日本語）→ 0件
        # 2回目: search_by_pattern（日本語）→ 0件
        # 3回目: Wikipedia「星のカービィ スーパーデラックス」でIGDB再検索 → ヒット
        # 4回目: Wikipedia「星のカービィ (アニメ)」でIGDB再検索 → 0件
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: igdb_wikipedia_match.to_json,
              headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it 'IGDB直接検索で見つからないゲームをWikipedia経由で見つける' do
        results = adapter.search('カービィ')
        expect(results.length).to eq(1)
        expect(results.first.external_api_id).to eq('3075')
      end

      it 'Wikipedia経由の結果に日本語タイトルをセットする' do
        results = adapter.search('カービィ')
        expect(results.first.title).to eq('星のカービィ スーパーデラックス')
      end

      it 'Wikipedia経由の結果に日本語説明をセットする' do
        results = adapter.search('カービィ')
        expect(results.first.description).to eq('任天堂が発売したアクションゲーム。')
      end
    end

    context '英語クエリではWikipedia検索を呼ばない' do
      let(:wikipedia_double) { instance_spy(ExternalApis::WikipediaGameAdapter) }

      before do
        allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(status: 200, body: igdb_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it 'WikipediaGameAdapterのsearch_titlesを呼び出さない' do
        adapter.search('Witcher')
        expect(wikipedia_double).not_to have_received(:search_titles)
      end
    end
  end

  describe '発売年によるリメイク版・原作版の区別' do
    let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

    # 1998年のオリジナル版と2019年のリメイク版
    let(:igdb_multiple_versions) do
      [
        {
          'id' => 732,
          'name' => 'Resident Evil 2',
          'summary' => 'Original 1998 version',
          'cover' => { 'image_id' => 'co1abc' },
          'first_release_date' => 885_427_200, # 1998-01-21
          'total_rating' => 85.0
        },
        {
          'id' => 19_686,
          'name' => 'Resident Evil 2',
          'summary' => '2019 remake version',
          'cover' => { 'image_id' => 'co2def' },
          'first_release_date' => 1_548_374_400, # 2019-01-25
          'total_rating' => 92.0
        }
      ]
    end

    before do
      allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
      allow(wikipedia_double).to receive_messages(search_titles: ['バイオハザード RE:2'], fetch_extract: 'カプコンのサバイバルホラーゲーム。')
    end

    context '括弧に発売年がある場合' do
      before do
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('バイオハザード RE:2').and_return('Resident Evil 2 (2019 video game)')

        # 1回目・2回目: IGDB直接検索（日本語）→ 0件
        # 3回目: Wikipedia経由でIGDB再検索 → 2件（1998版 + 2019版）
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: igdb_multiple_versions.to_json,
              headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it '発売年が一致するリメイク版（2019年）を優先して返す' do
        results = adapter.search('バイオハザードRE:2')
        expect(results.length).to eq(1)
        expect(results.first.external_api_id).to eq('19686')
        expect(results.first.description).to eq('カプコンのサバイバルホラーゲーム。')
      end
    end

    context '括弧に発売年がない場合' do
      before do
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('バイオハザード RE:2').and_return('Resident Evil 2')

        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: igdb_multiple_versions.to_json,
              headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it '最初のマッチ（人気順の先頭）を返す' do
        results = adapter.search('バイオハザードRE:2')
        expect(results.length).to eq(1)
        expect(results.first.external_api_id).to eq('732')
      end
    end
  end

  describe 'リトライミドルウェア' do
    let(:retry_success_body) do
      [{ 'id' => 1942, 'name' => 'Test Game', 'summary' => 'テストゲーム' }]
    end

    it 'サーバーエラー時にリトライして成功する' do
      stub_request(:post, 'https://api.igdb.com/v4/games')
        .to_return(status: 500, body: '[]', headers: { 'Content-Type' => 'application/json' })
        .then.to_return(status: 200, body: retry_success_body.to_json,
                        headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('Test')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('Test Game')
    end
  end

  describe 'タイムアウト設定' do
    it 'open_timeout と timeout が設定されている' do
      conn = adapter.send(:igdb_connection)
      expect(conn.options.open_timeout).to eq(5)
      expect(conn.options.timeout).to eq(10)
    end
  end

  describe '#safe_search' do
    it 'OAuth認証失敗時に空配列を返す' do
      stub_request(:post, 'https://id.twitch.tv/oauth2/token').to_return(status: 401)
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
