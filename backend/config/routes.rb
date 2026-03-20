Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
