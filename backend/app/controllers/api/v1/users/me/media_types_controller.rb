# frozen_string_literal: true

module Api
  module V1
    module Users
      module Me
        # 認証済みユーザー自身の distinct な media_type 一覧を返す。
        # PostHog の User Property 「distinct_media_types_count」算出に使う。
        # Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §3.2
        class MediaTypesController < ApplicationController
          before_action :authenticate_user!

          def index
            media_types = current_user.records
                                      .joins(:work)
                                      .distinct
                                      .pluck('works.media_type')
            render json: { media_types: media_types }
          end
        end
      end
    end
  end
end
