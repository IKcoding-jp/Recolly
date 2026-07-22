# frozen_string_literal: true

require 'rails_helper'

# L-1: ログに機密情報が平文で残らないよう、filter_parameters に含まれることを検証する。
# 特定クラスではなくアプリ設定の検証のため DescribeClass は無効化する。
RSpec.describe 'ログのパラメータフィルタ' do # rubocop:disable RSpec/DescribeClass
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it 'Google IDトークン(credential)をフィルタする' do
    filtered = filter.filter('credential' => 'secret-google-id-token')
    expect(filtered['credential']).to eq('[FILTERED]')
  end

  it 'パスワードをフィルタする（既存挙動の回帰確認）' do
    filtered = filter.filter('password' => 'p@ssw0rd')
    expect(filtered['password']).to eq('[FILTERED]')
  end

  it 'メールアドレスをフィルタする（既存挙動の回帰確認）' do
    filtered = filter.filter('email' => 'user@example.com')
    expect(filtered['email']).to eq('[FILTERED]')
  end
end
