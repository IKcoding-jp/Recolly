# frozen_string_literal: true

require 'rails_helper'

RSpec.describe S3DeleteService do
  let(:s3_key) { 'uploads/images/test-uuid.jpg' }
  let(:mock_client) { instance_double(Aws::S3::Client) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(mock_client)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('S3_BUCKET_NAME').and_return('test-bucket')
  end

  describe '.call' do
    it 'S3からファイルを削除する' do
      allow(mock_client).to receive(:delete_object)

      described_class.call(s3_key)

      expect(mock_client).to have_received(:delete_object).with(
        bucket: 'test-bucket',
        key: s3_key
      )
    end
  end
end
