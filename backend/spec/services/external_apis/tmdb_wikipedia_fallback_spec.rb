# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ExternalApis::TmdbWikipediaFallback, type: :service do
  subject(:fallback) do
    described_class.new(movie_search: movie_search, tv_search: tv_search, connection_factory: connection_factory)
  end

  let(:wikipedia_client) { instance_double(ExternalApis::WikipediaClient) }
  let(:movie_search) { ->(title, conn) { record_call(:movie, title, conn) } }
  let(:tv_search) { ->(title, conn) { record_call(:tv, title, conn) } }
  let(:connection_factory) { -> { new_connection } }

  let(:existing_result) do
    ExternalApis::BaseAdapter::SearchResult.new(
      '既存作品', 'movie', '既存の説明', 'https://example.com/existing.jpg', nil, '1', 'tmdb', {}
    )
  end

  before do
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wikipedia_client)
  end

  # movie_search/tv_searchが呼ばれた記録（デフォルトは空配列を返す＝マージ対象なし）
  # letにするとMultipleMemoizedHelpersの上限に達するため、インスタンス変数メモ化のメソッドにしている
  def calls
    @calls ||= []
  end

  def record_call(kind, title, conn)
    calls << [kind, title, conn]
    []
  end

  # connection_factoryが生成したコネクションの一覧（実体は不要なのでObjectで代用し同一性のみ検証する）
  def generated_connections
    @generated_connections ||= []
  end

  def new_connection
    conn = Object.new
    generated_connections << conn
    conn
  end

  def build_result(id, title: '追加作品')
    ExternalApis::BaseAdapter::SearchResult.new(
      title, 'movie', '追加の説明', 'https://example.com/added.jpg', nil, id, 'tmdb', {}
    )
  end

  describe '#search' do
    context 'Wikipediaが代替タイトルを返したとき' do
      before do
        allow(wikipedia_client).to receive(:search).with('クエリ', limit: 3)
                                                   .and_return(%w[代替タイトル1 代替タイトル2])
      end

      it 'movie_search/tv_searchを各タイトル×connection_factoryが生成したconnで呼び出す' do
        fallback.search('クエリ', [])

        kinds = calls.map { |(kind, _title, _conn)| kind }
        titles = calls.map { |(_kind, title, _conn)| title }
        conns = calls.map { |(_kind, _title, conn)| conn }

        expect(kinds).to contain_exactly(:movie, :movie, :tv, :tv)
        expect(titles).to contain_exactly('代替タイトル1', '代替タイトル1', '代替タイトル2', '代替タイトル2')
        expect(conns).to match_array(generated_connections)
      end

      it '追加検索の結果を既存結果にマージする' do
        movie_search_with_hit = lambda do |title, conn|
          record_call(:movie, title, conn)
          [build_result('99', title: title)]
        end
        fb = described_class.new(
          movie_search: movie_search_with_hit, tv_search: tv_search, connection_factory: connection_factory
        )

        results = fb.search('クエリ', [existing_result])

        expect(results.map(&:external_api_id)).to contain_exactly('1', '99')
      end
    end

    it 'Wikipedia結果からクエリと同一タイトルを除外する' do
      allow(wikipedia_client).to receive(:search).with('同じタイトル', limit: 3)
                                                 .and_return(%w[同じタイトル 別タイトル])

      fallback.search('同じタイトル', [])

      expect(calls.map { |(_kind, title, _conn)| title }.uniq).to eq(['別タイトル'])
    end

    it 'Wikipediaが空を返したら既存結果をそのまま返し追加検索しない' do
      allow(wikipedia_client).to receive(:search).and_return([])

      results = fallback.search('クエリ', [existing_result])

      expect(results).to eq([existing_result])
      expect(calls).to be_empty
    end

    it '既存結果と同じexternal_api_idの追加結果は重複除去する' do
      allow(wikipedia_client).to receive(:search).and_return(['代替タイトル'])
      duplicate_movie_search = lambda do |title, conn|
        record_call(:movie, title, conn)
        [build_result('1', title: title)]
      end
      fb = described_class.new(
        movie_search: duplicate_movie_search, tv_search: tv_search, connection_factory: connection_factory
      )

      results = fb.search('クエリ', [existing_result])

      expect(results.map(&:external_api_id)).to eq(['1'])
    end

    it 'movie_search側がFaraday::Errorを投げてもtv_search側の結果は活かされる' do
      allow(wikipedia_client).to receive(:search).and_return(['代替タイトル'])
      failing_movie_search = ->(_title, _conn) { raise Faraday::ConnectionFailed, 'timeout' }
      surviving_tv_search = ->(_title, _conn) { [build_result('42')] }
      fb = described_class.new(
        movie_search: failing_movie_search, tv_search: surviving_tv_search, connection_factory: connection_factory
      )

      results = fb.search('クエリ', [])

      expect(results.map(&:external_api_id)).to eq(['42'])
    end

    it 'WikipediaClientがStandardErrorを投げたら既存結果をそのまま返す' do
      allow(wikipedia_client).to receive(:search).and_raise(StandardError, 'wikipedia down')

      results = fallback.search('クエリ', [existing_result])

      expect(results).to eq([existing_result])
    end
  end
end
