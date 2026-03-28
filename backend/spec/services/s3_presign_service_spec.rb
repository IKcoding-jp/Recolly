# frozen_string_literal: true

require 'rails_helper'

RSpec.describe S3PresignService do
  let(:s3_key) { 'uploads/images/test-uuid.jpg' }
  let(:content_type) { 'image/jpeg' }
  let(:mock_presigner) { instance_double(Aws::S3::Presigner) }

  before do
    allow(Aws::S3::Presigner).to receive(:new).and_return(mock_presigner)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('S3_BUCKET_NAME').and_return('test-bucket')
  end

  describe '.presign_put' do
    it 'PUT用の署名付きURLを返す' do
      allow(mock_presigner).to receive(:presigned_url).and_return('https://s3.example.com/put-url')

      url = described_class.presign_put(s3_key, content_type)

      expect(url).to eq('https://s3.example.com/put-url')
      expect(mock_presigner).to have_received(:presigned_url).with(
        :put_object,
        bucket: 'test-bucket',
        key: s3_key,
        content_type: content_type,
        expires_in: 300
      )
    end
  end

  describe '.presign_get' do
    it 'GET用の署名付きURLを返す' do
      allow(mock_presigner).to receive(:presigned_url).and_return('https://s3.example.com/get-url')

      url = described_class.presign_get(s3_key)

      expect(url).to eq('https://s3.example.com/get-url')
      expect(mock_presigner).to have_received(:presigned_url).with(
        :get_object,
        bucket: 'test-bucket',
        key: s3_key,
        expires_in: 900
      )
    end
  end
end
