# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Tags', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }

  describe 'GET /api/v1/tags' do
    context '認証済み' do
      before { sign_in user }

      it 'ユーザーのタグ一覧を名前順で返す' do
        Tag.create!(name: 'ゾンビ', user: user)
        Tag.create!(name: 'アクション', user: user)
        Tag.create!(name: 'ゾンビ', user: other_user)

        get '/api/v1/tags', as: :json

        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        names = json['tags'].pluck('name')
        expect(names).to eq(%w[アクション ゾンビ])
      end

      it '他ユーザーのタグは含まれない' do
        Tag.create!(name: 'マイタグ', user: user)
        Tag.create!(name: '他人のタグ', user: other_user)

        get '/api/v1/tags', as: :json

        json = response.parsed_body
        expect(json['tags'].length).to eq(1)
        expect(json['tags'].first['name']).to eq('マイタグ')
      end
    end

    context '未認証' do
      it '401を返す' do
        get '/api/v1/tags', as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'DELETE /api/v1/tags/:id' do
    context '認証済み' do
      before { sign_in user }

      it 'タグと関連するrecord_tagsを削除して204を返す' do
        work = Work.create!(title: 'テスト作品', media_type: 'anime')
        record = Record.create!(user: user, work: work)
        tag = Tag.create!(name: 'お気に入り', user: user)
        RecordTag.create!(record: record, tag: tag)

        expect do
          delete "/api/v1/tags/#{tag.id}", as: :json
        end.to change(Tag, :count).by(-1).and change(RecordTag, :count).by(-1)

        expect(response).to have_http_status(:no_content)
      end

      it '他ユーザーのタグ削除は403を返す' do
        other_tag = Tag.create!(name: '他人のタグ', user: other_user)

        delete "/api/v1/tags/#{other_tag.id}", as: :json

        expect(response).to have_http_status(:forbidden)
        expect(Tag.find(other_tag.id)).to be_present
      end
    end

    context '未認証' do
      it '401を返す' do
        tag = Tag.create!(name: 'お気に入り', user: user)
        delete "/api/v1/tags/#{tag.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
