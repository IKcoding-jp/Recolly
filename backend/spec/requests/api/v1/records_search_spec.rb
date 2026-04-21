# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Records — キーワード検索', type: :request do
  let(:user) { User.create!(username: 'searchuser', email: 'search@example.com', password: 'password123') }

  before { sign_in user }

  def create_record(title, media_type: 'anime', status: :watching)
    work = Work.create!(title: title, media_type: media_type)
    Record.create!(user: user, work: work, status: status)
  end

  describe 'q パラメータ' do
    it 'タイトルに q を含む records のみ返す' do
      create_record('進撃の巨人')
      create_record('鋼の錬金術師')

      get '/api/v1/records', params: { q: '進撃' }

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('進撃の巨人')
    end

    it '大文字小文字を区別しない（ILIKE）' do
      create_record('Attack on Titan')

      get '/api/v1/records', params: { q: 'attack' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it 'LIKE メタ文字（%, _）をエスケープしリテラルとして扱う' do
      create_record('100%完全攻略')
      create_record('100満点')

      get '/api/v1/records', params: { q: '100%' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('100%完全攻略')
    end

    it 'q と status を AND で組み合わせる' do
      create_record('進撃の巨人', status: :watching)
      create_record('進撃の別作品', status: :completed)

      get '/api/v1/records', params: { q: '進撃', status: 'watching' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['status']).to eq('watching')
    end

    it '空文字の q は絞り込まない（全件返す）' do
      create_record('進撃の巨人')
      create_record('鋼の錬金術師')

      get '/api/v1/records', params: { q: '' }

      json = response.parsed_body
      expect(json['records'].length).to eq(2)
    end

    it '空白のみの q は絞り込まない' do
      create_record('進撃の巨人')

      get '/api/v1/records', params: { q: '   ' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it '他ユーザーの記録は返さない' do
      create_record('進撃の巨人')
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      other_work = Work.create!(title: '進撃の巨人の別記録', media_type: 'anime')
      Record.create!(user: other, work: other_work)

      get '/api/v1/records', params: { q: '進撃' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('進撃の巨人')
    end
  end
end
