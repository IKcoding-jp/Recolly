# frozen_string_literal: true

require 'rails_helper'
require 'rake'

# トップレベルで一度だけ Rake タスクをロード（before(:all) を避ける）
Rails.application.load_tasks if Rake::Task.tasks.empty?

RSpec.describe 'lockout:detect', type: :task do
  let(:task) { Rake::Task['lockout:detect'] }

  before { task.reenable }

  it 'ロックアウト状態のユーザーを検出して出力する' do
    # 正常: パスワード設定済み
    normal = User.create!(username: 'normaluser', email: 'normal@example.com', password: 'password123')
    normal.update_column(:password_set_at, Time.current) # rubocop:disable Rails/SkipsModelValidations

    # 正常: OAuth 専用ユーザー
    create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')

    # ロックアウト状態: password_set_at が nil かつ user_providers が空
    locked = User.new(username: 'lockeduser', email: 'locked@example.com', password: SecureRandom.hex(32))
    locked.save!
    # password_set_at は nil のまま
    # user_providers も作らない

    # .and で chain すると block が 2回実行されてしまうため、1つの正規表現にまとめる
    expect { task.invoke }.to output(/ロックアウト状態のユーザー: 1件.*lockeduser/m).to_stdout
  end

  it 'ロックアウトユーザーがいない場合は0件と出力' do
    normal = User.create!(username: 'normaluser', email: 'normal@example.com', password: 'password123')
    normal.update_column(:password_set_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
    create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')

    expect { task.invoke }.to output(/ロックアウト状態のユーザー: 0件/).to_stdout
  end
end
