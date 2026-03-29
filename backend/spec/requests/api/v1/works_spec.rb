# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe 'Api::V1::Works', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:mock_results) do
    [
      ExternalApis::BaseAdapter::SearchResult.new(
        title: 'テスト作品', media_type: 'anime', description: '説明',
        cover_image_url: 'https://example.com/img.jpg', total_episodes: 12,
        external_api_id: '1', external_api_source: 'anilist', metadata: {}
      )
    ]
  end

  before do
    service_double = instance_spy(WorkSearchService)
    allow(WorkSearchService).to receive(:new).and_return(service_double)
    allow(service_double).to receive(:search).and_return(mock_results)
  end

  describe 'GET /api/v1/works/search' do
    context '認証済み' do
      before { sign_in user }

      it 'キーワードで検索して結果を返す' do
        # GETリクエストのparamsはクエリストリングとして渡す（as: :json はPOST用）
        get '/api/v1/works/search', params: { q: 'テスト' }, headers: { 'Accept' => 'application/json' }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['results'].length).to eq(1)
        expect(json['results'].first['title']).to eq('テスト作品')
      end

      it 'media_typeフィルタで絞り込みできる' do
        get '/api/v1/works/search', params: { q: 'テスト', media_type: 'anime' },
                                    headers: { 'Accept' => 'application/json' }
        expect(response).to have_http_status(:ok)
      end

      it 'キーワード未指定で422' do
        get '/api/v1/works/search', params: {}, headers: { 'Accept' => 'application/json' }
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '未認証' do
      it '401を返す' do
        get '/api/v1/works/search', params: { q: 'テスト' }, headers: { 'Accept' => 'application/json' }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/works（手動登録）' do
    let(:work_params) do
      { work: { title: '手動登録作品', media_type: 'anime', description: '手動で追加' } }
    end

    context '認証済み' do
      before { sign_in user }

      it 'title + media_type で作品を登録して201を返す' do
        post '/api/v1/works', params: work_params, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['work']['title']).to eq('手動登録作品')
      end

      it 'Workレコードが作成される' do
        expect do
          post '/api/v1/works', params: work_params, as: :json
        end.to change(Work, :count).by(1)
      end

      it 'titleなしで422' do
        post '/api/v1/works', params: { work: { media_type: 'anime' } }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/works', params: work_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/works/:id/sync' do
    let(:user) { User.create!(username: 'syncuser', email: 'sync@example.com', password: 'password123') }
    let(:work) do
      Work.create!(
        title: 'ONE PIECE', media_type: 'manga',
        total_episodes: 100, external_api_id: '21',
        external_api_source: 'anilist',
        metadata: { 'status' => 'RELEASING' },
        last_synced_at: 25.hours.ago
      )
    end

    before { sign_in user }

    context 'sync が必要な場合（24時間経過）' do
      before do
        stub_request(:post, 'https://graphql.anilist.co')
          .to_return(
            status: 200,
            body: {
              'data' => {
                'Media' => {
                  'id' => 21, 'volumes' => 110, 'episodes' => nil,
                  'chapters' => 1100, 'status' => 'RELEASING'
                }
              }
            }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end

      it 'AniListからデータを同期して更新後の作品を返す' do
        post "/api/v1/works/#{work.id}/sync"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['work']['total_episodes']).to eq(110)
      end
    end

    context 'sync が不要な場合（24時間以内）' do
      let(:work) do
        Work.create!(
          title: 'ONE PIECE', media_type: 'manga',
          total_episodes: 110, external_api_id: '21',
          external_api_source: 'anilist',
          last_synced_at: 1.hour.ago
        )
      end

      it 'AniListに問い合わせずに現在のデータを返す' do
        post "/api/v1/works/#{work.id}/sync"
        expect(response).to have_http_status(:ok)
        expect(WebMock).not_to have_requested(:post, 'https://graphql.anilist.co')
      end
    end

    context '未認証の場合' do
      before { sign_out user }

      it '401を返す' do
        post "/api/v1/works/#{work.id}/sync"
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
