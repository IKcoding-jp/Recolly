# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Records', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:existing_work) { Work.create!(title: '既存作品', media_type: 'anime') }

  describe 'POST /api/v1/records' do
    context '認証済み' do
      before { sign_in user }

      it '既存Workへの記録追加で201を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['record']['work_id']).to eq(existing_work.id)
        expect(json['record']['status']).to eq('plan_to_watch')
      end

      it 'ステータスと評価を指定して記録を作成' do
        post '/api/v1/records', params: {
          record: { work_id: existing_work.id, status: 'watching', rating: 7 }
        }, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['record']['status']).to eq('watching')
        expect(json['record']['rating']).to eq(7)
      end

      it 'work_data からWorkを作成して記録追加（検索結果から記録）' do
        params = { record: { work_data: { title: '新規作品', media_type: 'anime',
                                          external_api_id: '99999', external_api_source: 'anilist' } } }
        expect do
          post '/api/v1/records', params: params, as: :json
        end.to change(Work, :count).by(1).and change(Record, :count).by(1)
        expect(response).to have_http_status(:created)
      end

      it '同じexternal_api_id + sourceのWorkが既存なら再利用する' do
        Work.create!(title: '既存外部作品', media_type: 'anime',
                     external_api_id: '99999', external_api_source: 'anilist')
        params = { record: { work_data: { title: '既存外部作品', media_type: 'anime',
                                          external_api_id: '99999', external_api_source: 'anilist' } } }
        expect do
          post '/api/v1/records', params: params, as: :json
        end.not_to change(Work, :count)
        expect(Record.count).to eq(1)
      end

      it '同じ作品を二重記録しようとすると422' do
        Record.create!(user: user, work: existing_work)
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'work_id も work_data もない場合は422' do
        post '/api/v1/records', params: { record: {} }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /api/v1/records' do
    context '認証済み' do
      before { sign_in user }

      it '自分の記録一覧を返す' do
        Record.create!(user: user, work: existing_work, status: :watching)
        other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
        other_work = Work.create!(title: '他の作品', media_type: 'movie')
        Record.create!(user: other_user, work: other_work)

        get '/api/v1/records', as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
        expect(json['records'][0]['work']['title']).to eq('既存作品')
      end

      it 'status でフィルタできる' do
        Record.create!(user: user, work: existing_work, status: :watching)
        another_work = Work.create!(title: '別作品', media_type: 'movie')
        Record.create!(user: user, work: another_work, status: :completed)

        get '/api/v1/records', params: { status: 'watching' }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
        expect(json['records'][0]['status']).to eq('watching')
      end

      it 'media_type でフィルタできる' do
        Record.create!(user: user, work: existing_work, status: :watching)
        movie_work = Work.create!(title: '映画作品', media_type: 'movie')
        Record.create!(user: user, work: movie_work, status: :watching)

        get '/api/v1/records', params: { media_type: 'anime' }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
      end

      it 'work_id でフィルタできる' do
        Record.create!(user: user, work: existing_work, status: :watching)
        another_work = Work.create!(title: '別作品', media_type: 'movie')
        Record.create!(user: user, work: another_work)

        get '/api/v1/records', params: { work_id: existing_work.id }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
      end

      it 'page と per_page でページネーションできる', :aggregate_failures do
        works = 3.times.map { |i| Work.create!(title: "作品#{i}", media_type: 'anime') }
        works.each { |w| Record.create!(user: user, work: w, status: :watching) }

        get '/api/v1/records', params: { page: 1, per_page: 2 }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['records'].length).to eq(2)
        expect(json['meta']['current_page']).to eq(1)
        expect(json['meta']['total_pages']).to eq(2)
        expect(json['meta']['total_count']).to eq(3)
        expect(json['meta']['per_page']).to eq(2)
      end

      it '2ページ目を取得できる' do
        works = 3.times.map { |i| Work.create!(title: "作品#{i}", media_type: 'anime') }
        works.each { |w| Record.create!(user: user, work: w, status: :watching) }

        get '/api/v1/records', params: { page: 2, per_page: 2 }
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
        expect(json['meta']['current_page']).to eq(2)
      end

      it 'per_page が100を超える場合は100に制限される' do
        Record.create!(user: user, work: existing_work, status: :watching)
        get '/api/v1/records', params: { page: 1, per_page: 200 }
        json = response.parsed_body
        expect(json['meta']['per_page']).to eq(100)
      end

      it 'page/per_page を指定しない場合はmeta なしで全件返す（後方互換）' do
        Record.create!(user: user, work: existing_work, status: :watching)
        get '/api/v1/records'
        json = response.parsed_body
        expect(json['records'].length).to eq(1)
        expect(json).not_to have_key('meta')
      end

      it 'デフォルトで updated_at 降順にソートされる' do
        Record.create!(user: user, work: existing_work, status: :watching)
        another_work = Work.create!(title: '別作品', media_type: 'movie')
        record2 = Record.create!(user: user, work: another_work, status: :completed)

        get '/api/v1/records'
        json = response.parsed_body
        expect(json['records'][0]['id']).to eq(record2.id)
      end
    end

    context '未認証' do
      it '401を返す' do
        get '/api/v1/records', as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /api/v1/records/:id' do
    context '認証済み' do
      before { sign_in user }

      it '自分の記録を返す' do
        record = Record.create!(user: user, work: existing_work, status: :watching, rating: 7)
        get "/api/v1/records/#{record.id}", as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['record']['rating']).to eq(7)
        expect(json['record']['work']['title']).to eq('既存作品')
      end

      it '存在しないIDには404を返す' do
        get '/api/v1/records/999999', as: :json
        expect(response).to have_http_status(:not_found)
      end

      it '他ユーザーの記録には403を返す' do
        other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
        record = Record.create!(user: other_user, work: existing_work)
        get "/api/v1/records/#{record.id}", as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        record = Record.create!(user: user, work: existing_work)
        get "/api/v1/records/#{record.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PATCH /api/v1/records/:id' do
    context '認証済み' do
      before { sign_in user }

      it 'ステータスを更新できる' do
        record = Record.create!(user: user, work: existing_work)
        patch "/api/v1/records/#{record.id}", params: { record: { status: 'watching' } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body['record']['status']).to eq('watching')
      end

      it '評価を更新できる' do
        record = Record.create!(user: user, work: existing_work, status: :watching)
        patch "/api/v1/records/#{record.id}", params: { record: { rating: 8 } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body['record']['rating']).to eq(8)
      end

      it '進捗を更新できる' do
        work_with_ep = Work.create!(title: 'アニメA', media_type: 'anime', total_episodes: 24)
        record = Record.create!(user: user, work: work_with_ep, status: :watching, current_episode: 5)
        patch "/api/v1/records/#{record.id}", params: { record: { current_episode: 6 } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body['record']['current_episode']).to eq(6)
      end

      it '他ユーザーの記録は更新できない' do
        other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
        record = Record.create!(user: other_user, work: existing_work)
        patch "/api/v1/records/#{record.id}", params: { record: { status: 'watching' } }, as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it '無効なrating で422を返す' do
        record = Record.create!(user: user, work: existing_work)
        patch "/api/v1/records/#{record.id}", params: { record: { rating: 15 } }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it '開始日と完了日を更新できる' do
        record = Record.create!(user: user, work: existing_work, status: :watching)
        patch "/api/v1/records/#{record.id}", params: {
          record: { started_at: '2026-01-01', completed_at: '2026-03-01' }
        }, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['record']['started_at']).to eq('2026-01-01')
        expect(json['record']['completed_at']).to eq('2026-03-01')
      end
    end

    context '未認証' do
      it '401を返す' do
        record = Record.create!(user: user, work: existing_work)
        patch "/api/v1/records/#{record.id}", params: { record: { status: 'watching' } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PATCH /api/v1/records/:id — review_text' do
    before { sign_in user }

    it 'review_textを更新できる' do
      record = Record.create!(user: user, work: existing_work)
      patch "/api/v1/records/#{record.id}",
            params: { record: { review_text: '素晴らしい作品だった' } }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['record']['review_text']).to eq('素晴らしい作品だった')
    end
  end

  describe 'PATCH /api/v1/records/:id — rewatch_count' do
    before { sign_in user }

    it 'rewatch_countを更新できる' do
      record = Record.create!(user: user, work: existing_work)
      patch "/api/v1/records/#{record.id}",
            params: { record: { rewatch_count: 2 } }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['record']['rewatch_count']).to eq(2)
    end
  end

  describe 'DELETE /api/v1/records/:id' do
    context '認証済み' do
      before { sign_in user }

      it '記録を削除して204を返す' do
        record = Record.create!(user: user, work: existing_work)
        expect do
          delete "/api/v1/records/#{record.id}", as: :json
        end.to change(Record, :count).by(-1)
        expect(response).to have_http_status(:no_content)
      end

      it '他ユーザーの記録は削除できない' do
        other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
        record = Record.create!(user: other_user, work: existing_work)
        delete "/api/v1/records/#{record.id}", as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        record = Record.create!(user: user, work: existing_work)
        delete "/api/v1/records/#{record.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
