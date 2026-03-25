# frozen_string_literal: true

Rails.application.routes.draw do
  # devise認証エンドポイント（/api/v1/ 配下）
  devise_for :users,
             path: "api/v1",
             path_names: { sign_in: "login", sign_out: "logout", registration: "signup" },
             controllers: {
               sessions: "api/v1/sessions",
               registrations: "api/v1/registrations",
               passwords: "api/v1/passwords",
               omniauth_callbacks: "api/v1/omniauth_callbacks"
             }

  namespace :api do
    namespace :v1 do
      # 認証済みユーザー情報取得
      resource :current_user, only: [:show], controller: "current_user"

      get 'csrf_token', to: 'csrf_tokens#show'

      post 'auth/complete_registration', to: 'oauth_registrations#create'

      resource :account_settings, only: [] do
        post :link_provider
        delete :unlink_provider
        put :set_password
        put :set_email
      end

      # 作品検索・手動登録
      resources :works, only: [:create] do
        collection do
          get :search
        end
      end

      # タグ管理（ユーザー所有タグの一覧・削除）
      resources :tags, only: %i[index destroy]

      # 記録（ライブラリ追加）
      resources :records, only: %i[index show create update destroy] do
        resources :episode_reviews, only: %i[index create update destroy]
        resources :tags, only: %i[create destroy], controller: 'record_tags'
      end

      # 統計（単一リソースのためIDなし）
      resource :statistics, only: [:show], controller: 'statistics'

      get "health", to: "health#show"
    end
  end

  # letter_opener_web（開発環境でメールをブラウザプレビュー）
  mount LetterOpenerWeb::Engine, at: "/letter_opener" if Rails.env.development?

  get "up" => "rails/health#show", as: :rails_health_check
end
