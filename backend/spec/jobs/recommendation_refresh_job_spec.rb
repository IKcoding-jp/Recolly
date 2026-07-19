require 'rails_helper'

RSpec.describe RecommendationRefreshJob, type: :job do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  it 'RecommendationService#generateを呼び出す' do
    service_double = instance_double(RecommendationService)
    allow(RecommendationService).to receive(:new).with(user).and_return(service_double)
    allow(service_double).to receive(:generate)

    described_class.perform_now(user.id)

    expect(service_double).to have_received(:generate)
  end

  it '存在しないuser_idでもエラーにならない' do
    expect { described_class.perform_now(999_999) }.not_to raise_error
  end

  it 'defaultキューに入る' do
    expect(described_class.new.queue_name).to eq('default')
  end

  describe '.enqueue_once' do
    around do |example|
      original_cache = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      example.run
    ensure
      Rails.cache = original_cache
    end

    it 'フラグが無ければジョブをエンキューする' do
      expect { described_class.enqueue_once(1) }.to have_enqueued_job(described_class).with(1)
    end

    it 'フラグが立っている間は再エンキューしない' do
      described_class.enqueue_once(1)
      expect { described_class.enqueue_once(1) }.not_to have_enqueued_job(described_class)
    end

    it 'perform完了後はフラグが消え再エンキューできる' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      allow_any_instance_of(RecommendationService).to receive(:generate).and_return(nil) # rubocop:disable RSpec/AnyInstance

      described_class.enqueue_once(user.id)
      described_class.perform_now(user.id)
      expect { described_class.enqueue_once(user.id) }.to have_enqueued_job(described_class)
    end
  end
end
