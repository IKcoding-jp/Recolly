# frozen_string_literal: true

module Api
  module V1
    class CsrfTokensController < ApplicationController
      def show
        render json: { token: form_authenticity_token }
      end
    end
  end
end
