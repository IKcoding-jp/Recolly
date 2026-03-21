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

      # 作品検索・手動登録
      resources :works, only: [:create] do
        collection do
          get :search
        end
      end

      # 記録（ライブラリ追加）
      resources :records, only: [:create]

      get "health", to: "health#show"
    end
  end

  # letter_opener_web（開発環境でメールをブラウザプレビュー）
  mount LetterOpenerWeb::Engine, at: "/letter_opener" if Rails.env.development?

  get "up" => "rails/health#show", as: :rails_health_check
end
