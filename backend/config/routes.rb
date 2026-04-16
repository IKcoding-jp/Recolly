# frozen_string_literal: true

Rails.application.routes.draw do
  # devise認証エンドポイント（/api/v1/ 配下）
  devise_for :users,
             path: "api/v1",
             path_names: { sign_in: "login", sign_out: "logout", registration: "signup" },
             controllers: {
               sessions: "api/v1/sessions",
               registrations: "api/v1/registrations",
               passwords: "api/v1/passwords"
             }

  namespace :api do
    namespace :v1 do
      # 認証済みユーザー情報取得
      resource :current_user, only: [:show], controller: "current_user"

      get 'csrf_token', to: 'csrf_tokens#show'

      # Google Identity Services（ADR-0035）: ID Tokenを受け取ってログイン処理
      post 'auth/google_id_token', to: 'google_id_token_sessions#create'

      post 'auth/complete_registration', to: 'oauth_registrations#create'

      resource :account_settings, only: [] do
        post :link_provider
        delete :unlink_provider
        put :set_password
        put :set_email
      end

      # プロフィール更新
      resource :profile, only: [:update], controller: 'profile' do
        post :presign_avatar
        put :favorite_works, action: :update_favorite_works
      end

      # 画像アップロード
      resources :images, only: %i[create destroy] do
        collection do
          post :presign
        end
      end

      # 作品検索・手動登録・同期
      resources :works, only: [:create] do
        collection do
          get :search
        end
        member do
          post :sync
        end
        resources :discussions, only: %i[index create]
      end

      # ディスカッション（全体一覧・詳細・編集・削除）
      resources :discussions, only: %i[index show update destroy] do
        resources :comments, only: %i[index create]
      end

      # コメント（編集・削除）
      resources :comments, only: %i[update destroy]

      # ユーザープロフィール・記録一覧
      resources :users, only: [:show], controller: 'profiles' do
        resources :records, only: [:index], controller: 'user_records'
        resources :favorite_works, only: [:index], controller: 'favorite_works'
      end

      # タグ管理（ユーザー所有タグの一覧・削除）
      resources :tags, only: %i[index destroy]

      # 記録（ライブラリ追加）
      resources :records, only: %i[index show create update destroy] do
        collection do
          get :recorded_external_ids
        end
        resources :episode_reviews, only: %i[index create update destroy]
        resources :tags, only: %i[create destroy], controller: 'record_tags'
      end

      # 認証済みユーザー自身のメディアタイプ一覧（PostHog 計測に使う）
      namespace :users do
        namespace :me do
          get :media_types, to: 'media_types#index'
        end
      end

      # 統計（単一リソースのためIDなし）
      resource :statistics, only: [:show], controller: 'statistics'

      # おすすめ（単一リソースのためIDなし）
      resource :recommendations, only: [:show] do
        post :refresh, on: :collection
      end

      get "health", to: "health#show"
    end
  end

  # letter_opener_web（開発環境でメールをブラウザプレビュー）
  mount LetterOpenerWeb::Engine, at: "/letter_opener" if Rails.env.development?

  get "up" => "rails/health#show", as: :rails_health_check
end
