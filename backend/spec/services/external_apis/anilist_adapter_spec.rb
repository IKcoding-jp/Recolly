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
                'genres' => %w[Action Drama],
                'status' => 'FINISHED',
                'seasonYear' => 2013
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
                'type' => 'MANGA',
                'genres' => %w[Action Drama],
                'status' => 'FINISHED'
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
  end

  describe '#safe_search' do
    it 'APIエラー時に空配列を返す' do
      stub_request(:post, 'https://graphql.anilist.co').to_return(status: 500)
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
