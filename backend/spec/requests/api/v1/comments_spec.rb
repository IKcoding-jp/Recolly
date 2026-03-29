# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Comments', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
  let!(:record) { Record.create!(user: user, work: work, status: :watching) }
  let(:discussion) { Discussion.create!(title: 'テストスレッド', body: 'テスト本文', user: user, work: work) }

  describe 'GET /api/v1/discussions/:discussion_id/comments' do
    let!(:first_comment) { Comment.create!(body: 'コメント1', user: user, discussion: discussion) }
    let!(:second_comment) { Comment.create!(body: 'コメント2', user: user, discussion: discussion) }

    it 'コメント一覧を古い順で返す' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['comments'].length).to eq(2)
      expect(json['comments'][0]['body']).to eq('コメント1')
      expect(json['comments'][1]['body']).to eq('コメント2')
    end

    it 'ログインなしでも取得できる' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      expect(response).to have_http_status(:ok)
    end

    it 'ユーザー情報を含む' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      json = response.parsed_body
      expect(json['comments'][0]['user']['username']).to eq('testuser')
    end

    it '編集済みフラグが正しく返る' do
      first_comment.update!(body: '編集後コメント')
      get "/api/v1/discussions/#{discussion.id}/comments"
      json = response.parsed_body
      expect(json['comments'][0]['edited']).to be true
      expect(json['comments'][1]['edited']).to be false
    end

    it 'ページネーションが動作する' do
      get "/api/v1/discussions/#{discussion.id}/comments?page=1&per_page=1"
      json = response.parsed_body
      expect(json['comments'].length).to eq(1)
      expect(json['meta']['total_count']).to eq(2)
    end
  end

  describe 'POST /api/v1/discussions/:discussion_id/comments' do
    context '認証済み + 記録済みユーザー' do
      before { sign_in user }

      it 'コメントを投稿できる' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: '新しいコメント' } },
             as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['comment']['body']).to eq('新しいコメント')
      end

      it 'discussion の comments_count が増加する' do
        expect do
          post "/api/v1/discussions/#{discussion.id}/comments",
               params: { comment: { body: 'テスト' } },
               as: :json
        end.to change { discussion.reload.comments_count }.by(1)
      end
    end

    context '認証済みだが未記録ユーザー' do
      let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }

      before { sign_in other_user }

      it '403を返す' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: 'テスト' } },
             as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: 'テスト' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PATCH /api/v1/comments/:id' do
    let!(:comment) { Comment.create!(body: '元のコメント', user: user, discussion: discussion) }

    context '投稿者本人' do
      before { sign_in user }

      it 'コメントを編集できる' do
        patch "/api/v1/comments/#{comment.id}",
              params: { comment: { body: '編集後のコメント' } },
              as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['comment']['body']).to eq('編集後のコメント')
        expect(json['comment']['edited']).to be true
      end
    end

    context '投稿者以外' do
      let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }

      before { sign_in other_user }

      it '403を返す' do
        patch "/api/v1/comments/#{comment.id}",
              params: { comment: { body: '不正な編集' } },
              as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'DELETE /api/v1/comments/:id' do
    let!(:comment) { Comment.create!(body: 'テスト', user: user, discussion: discussion) }

    context '投稿者本人' do
      before { sign_in user }

      it 'コメントを削除できる' do
        expect do
          delete "/api/v1/comments/#{comment.id}"
        end.to change(Comment, :count).by(-1)
        expect(response).to have_http_status(:no_content)
      end

      it 'discussion の comments_count が減少する' do
        expect do
          delete "/api/v1/comments/#{comment.id}"
        end.to change { discussion.reload.comments_count }.by(-1)
      end
    end

    context '投稿者以外' do
      let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }

      before { sign_in other_user }

      it '403を返す' do
        delete "/api/v1/comments/#{comment.id}"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
