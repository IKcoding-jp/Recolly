# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::AniListAdapter, type: :service do
  subject(:adapter) { described_class.new }

  describe '#media_types' do
    it 'anime と manga を返す' do
      expect(adapter.media_types).to eq(%w[anime manga])
    end
  end

  describe '#search' do
    let(:anilist_response) do
      {
        'data' => {
          'Page' => {
            'media' => [
              {
                'id' => 16_498,
                'title' => { 'romaji' => 'Shingeki no Kyojin', 'native' => '進撃の巨人' },
                'description' => '巨人が支配する世界',
                'coverImage' => {
                  'large' =>
                    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.jpg'
                },
                'episodes' => 25,
                'type' => 'ANIME',
                'format' => 'TV',
                'genres' => %w[Action Drama],
                'status' => 'FINISHED',
                'seasonYear' => 2013,
                'popularity' => 500_000
              },
              {
                'id' => 53_390,
                'title' => { 'romaji' => 'Shingeki no Kyojin', 'native' => '進撃の巨人' },
                'description' => '巨人が支配する世界（漫画版）',
                'coverImage' => {
                  'large' =>
                    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx53390.jpg'
                },
                'chapters' => 139,
                'volumes' => 34,
                'type' => 'MANGA',
                'format' => 'MANGA',
                'genres' => %w[Action Drama],
                'status' => 'FINISHED',
                'popularity' => 300_000
              }
            ]
          }
        }
      }
    end

    before do
      stub_request(:post, 'https://graphql.anilist.co')
        .to_return(status: 200, body: anilist_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'anime と manga の結果を返す' do
      results = adapter.search('進撃の巨人')
      expect(results.length).to eq(2)
      expect(results.map(&:media_type)).to contain_exactly('anime', 'manga')
    end

    it 'アニメの結果を統一フォーマットで返す' do
      results = adapter.search('進撃の巨人')
      anime = results.find { |r| r.media_type == 'anime' }
      expect(anime.title).to eq('進撃の巨人')
      expect(anime.external_api_id).to eq('16498')
      expect(anime.external_api_source).to eq('anilist')
      expect(anime.total_episodes).to eq(25)
    end

    it 'native タイトルを優先する' do
      results = adapter.search('進撃の巨人')
      expect(results.first.title).to eq('進撃の巨人')
    end

    it '漫画の total_episodes に volumes（巻数）を使用する' do
      results = adapter.search('進撃の巨人')
      manga = results.find { |r| r.media_type == 'manga' }
      expect(manga.total_episodes).to eq(34)
    end

    it 'アニメの total_episodes は episodes のまま' do
      results = adapter.search('進撃の巨人')
      anime = results.find { |r| r.media_type == 'anime' }
      expect(anime.total_episodes).to eq(25)
    end

    it 'popularity（正規化済み）をmetadataに含める' do
      results = adapter.search('進撃の巨人')
      anime = results.find { |r| r.media_type == 'anime' }
      # 500,000 / 100,000 = 5.0 → min(5.0, 1.0) = 1.0
      expect(anime.metadata[:popularity]).to eq(1.0)
    end
  end

  describe 'アニメ映画の分類' do
    let(:movie_response) do
      {
        'data' => {
          'Page' => {
            'media' => [
              {
                'id' => 199,
                'title' => { 'romaji' => 'Sen to Chihiro no Kamikakushi',
                             'native' => '千と千尋の神隠し', 'english' => 'Spirited Away' },
                'description' => 'A young girl becomes trapped in a strange new world',
                'coverImage' => { 'large' => 'https://example.com/spirited.jpg' },
                'episodes' => 1,
                'type' => 'ANIME',
                'format' => 'MOVIE',
                'genres' => %w[Adventure Fantasy],
                'status' => 'FINISHED',
                'seasonYear' => 2001,
                'popularity' => 200_000
              },
              {
                'id' => 20,
                'title' => { 'romaji' => 'Naruto', 'native' => 'NARUTO -ナルト-' },
                'description' => 'Ninja anime',
                'coverImage' => { 'large' => 'https://example.com/naruto.jpg' },
                'episodes' => 220,
                'type' => 'ANIME',
                'format' => 'TV',
                'genres' => %w[Action Adventure],
                'status' => 'FINISHED',
                'seasonYear' => 2002,
                'popularity' => 400_000
              }
            ]
          }
        }
      }
    end

    before do
      stub_request(:post, 'https://graphql.anilist.co')
        .to_return(status: 200, body: movie_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'format: MOVIE のアニメを movie に分類する' do
      results = adapter.search('千と千尋')
      movie = results.find { |r| r.title == '千と千尋の神隠し' }
      expect(movie.media_type).to eq('movie')
    end

    it 'format: TV のアニメは anime のまま' do
      results = adapter.search('千と千尋')
      tv = results.find { |r| r.title == 'NARUTO -ナルト-' }
      expect(tv.media_type).to eq('anime')
    end
  end

  describe '#safe_search' do
    it 'APIエラー時に空配列を返す' do
      stub_request(:post, 'https://graphql.anilist.co').to_return(status: 500)
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
