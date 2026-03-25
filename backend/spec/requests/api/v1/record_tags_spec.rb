# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::RecordTags', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: 'anime') }
  let(:record) { Record.create!(user: user, work: work) }

  describe 'POST /api/v1/records/:record_id/tags' do
    context '認証済み' do
      before { sign_in user }

      it '新規タグを作成して記録に紐付け、201を返す' do
        expect do
          post "/api/v1/records/#{record.id}/tags",
               params: { tag: { name: 'お気に入り' } }, as: :json
        end.to change(Tag, :count).by(1).and change(RecordTag, :count).by(1)

        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['tag']['name']).to eq('お気に入り')
      end

      it '既存タグは再利用して記録に紐付ける' do
        existing_tag = Tag.create!(name: 'お気に入り', user: user)

        expect do
          post "/api/v1/records/#{record.id}/tags",
               params: { tag: { name: 'お気に入り' } }, as: :json
        end.not_to change(Tag, :count)

        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['tag']['id']).to eq(existing_tag.id)
      end

      it '同一タグの重複付与は422を返す' do
        tag = Tag.create!(name: 'お気に入り', user: user)
        RecordTag.create!(record: record, tag: tag)

        post "/api/v1/records/#{record.id}/tags",
             params: { tag: { name: 'お気に入り' } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it '他ユーザーの記録へのタグ付与は403を返す' do
        other_record = Record.create!(user: other_user, work: work)

        post "/api/v1/records/#{other_record.id}/tags",
             params: { tag: { name: 'お気に入り' } }, as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        post "/api/v1/records/#{record.id}/tags",
             params: { tag: { name: 'お気に入り' } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'DELETE /api/v1/records/:record_id/tags/:id' do
    context '認証済み' do
      before { sign_in user }

      it 'record_tagを削除してタグ自体は残す（204を返す）' do
        tag = Tag.create!(name: 'お気に入り', user: user)
        RecordTag.create!(record: record, tag: tag)

        expect do
          delete "/api/v1/records/#{record.id}/tags/#{tag.id}", as: :json
        end.to change(RecordTag, :count).by(-1).and change(Tag, :count).by(0)

        expect(response).to have_http_status(:no_content)
        expect(Tag.find(tag.id)).to be_present
      end

      it '他ユーザーの記録からのタグ削除は403を返す' do
        other_record = Record.create!(user: other_user, work: work)
        tag = Tag.create!(name: 'お気に入り', user: other_user)
        RecordTag.create!(record: other_record, tag: tag)

        delete "/api/v1/records/#{other_record.id}/tags/#{tag.id}", as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        tag = Tag.create!(name: 'お気に入り', user: user)
        RecordTag.create!(record: record, tag: tag)
        delete "/api/v1/records/#{record.id}/tags/#{tag.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
