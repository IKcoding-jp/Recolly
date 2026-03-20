require "rails_helper"

RSpec.describe "ヘルスチェックAPI", type: :request do
  describe "GET /api/v1/health" do
    it "ステータス200と{status: ok}を返す" do
      get "/api/v1/health"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("ok")
    end
  end
end
