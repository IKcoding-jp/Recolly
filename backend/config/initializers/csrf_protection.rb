# frozen_string_literal: true

# CSRF対策（診断M-2 / ADR-0052）: 状態変更リクエストにカスタムヘッダ（X-Requested-With）を
# 必須化するためのフラグ。ApplicationController#verify_csrf_protection_header! がこの値を見る。
# テストでは既定で無効化し、専用spec（csrf_protection_spec）だけが有効化する
# （連続リクエストを行う他のrequest specへ副作用を出さないため）。
Rails.application.config.x.csrf_header_protection = !Rails.env.test?
