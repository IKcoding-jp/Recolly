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
end
