# frozen_string_literal: true

require 'rails_helper'

RSpec.describe OrphanedImageCleanupJob, type: :job do
  let(:mock_client) { instance_double(Aws::S3::Client) }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(mock_client)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('S3_BUCKET_NAME').and_return('test-bucket')
  end

  context 'S3に孤立ファイルがある場合' do
    let(:existing_key) { 'uploads/images/exists.jpg' }
    let(:orphaned_key) { 'uploads/images/orphaned.jpg' }
    let(:s3_objects) { [double(key: existing_key), double(key: orphaned_key)] }

    before do
      Image.create!(
        imageable: work,
        s3_key: existing_key,
        file_name: 'exists.jpg',
        content_type: 'image/jpeg',
        file_size: 1000
      )
      allow(mock_client).to receive(:list_objects_v2).and_return(
        double(contents: s3_objects, is_truncated: false)
      )
      allow(mock_client).to receive(:delete_object)
      described_class.perform_now
    end

    it 'DBに記録がないS3ファイルを削除する' do
      expect(mock_client).to have_received(:delete_object).with(
        bucket: 'test-bucket', key: orphaned_key
      )
    end

    it 'DBに記録があるS3ファイルは削除しない' do
      expect(mock_client).not_to have_received(:delete_object).with(
        bucket: 'test-bucket', key: existing_key
      )
    end
  end

  context 'S3にファイルがない場合' do
    before do
      allow(mock_client).to receive(:list_objects_v2).and_return(
        double(contents: [], is_truncated: false)
      )
    end

    it '何もしない' do
      expect { described_class.perform_now }.not_to raise_error
    end
  end
end
