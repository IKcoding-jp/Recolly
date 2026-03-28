# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Image, type: :model do
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }

  let(:valid_attributes) do
    {
      imageable: work,
      s3_key: "uploads/images/#{SecureRandom.uuid}.jpg",
      file_name: 'cover.jpg',
      content_type: 'image/jpeg',
      file_size: 1_200_000
    }
  end

  describe 'バリデーション' do
    it '全属性が正しければ有効' do
      image = described_class.new(valid_attributes)
      expect(image).to be_valid
    end

    it 's3_keyが必須' do
      image = described_class.new(valid_attributes.merge(s3_key: nil))
      expect(image).not_to be_valid
      expect(image.errors[:s3_key]).to include("can't be blank")
    end

    it 's3_keyが一意' do
      described_class.create!(valid_attributes)
      duplicate = described_class.new(valid_attributes.merge(file_name: 'other.jpg'))
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:s3_key]).to include('has already been taken')
    end

    it 'file_nameが必須' do
      image = described_class.new(valid_attributes.merge(file_name: nil))
      expect(image).not_to be_valid
    end

    it 'content_typeが必須' do
      image = described_class.new(valid_attributes.merge(content_type: nil))
      expect(image).not_to be_valid
    end

    it 'content_typeが許可リストに含まれる' do
      %w[image/jpeg image/png image/gif image/webp].each do |ct|
        image = described_class.new(valid_attributes.merge(content_type: ct))
        expect(image).to be_valid, "#{ct} は有効であるべき"
      end
    end

    it 'content_typeが許可リスト外なら無効' do
      image = described_class.new(valid_attributes.merge(content_type: 'application/pdf'))
      expect(image).not_to be_valid
      expect(image.errors[:content_type]).to include('は対応していない形式です')
    end

    it 'file_sizeが必須' do
      image = described_class.new(valid_attributes.merge(file_size: nil))
      expect(image).not_to be_valid
    end

    it 'file_sizeが10MB以下なら有効' do
      image = described_class.new(valid_attributes.merge(file_size: 10 * 1024 * 1024))
      expect(image).to be_valid
    end

    it 'file_sizeが10MB超なら無効' do
      image = described_class.new(valid_attributes.merge(file_size: (10 * 1024 * 1024) + 1))
      expect(image).not_to be_valid
      expect(image.errors[:file_size]).to include('は10MB以下にしてください')
    end

    it 'imageableが必須' do
      image = described_class.new(valid_attributes.merge(imageable: nil))
      expect(image).not_to be_valid
    end
  end

  describe 'アソシエーション' do
    it 'Workにポリモーフィック関連で紐づく' do
      image = described_class.create!(valid_attributes)
      expect(image.imageable).to eq(work)
      expect(image.imageable_type).to eq('Work')
      expect(image.imageable_id).to eq(work.id)
    end
  end
end
