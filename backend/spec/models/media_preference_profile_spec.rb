require 'rails_helper'

RSpec.describe MediaPreferenceProfile, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'バリデーション' do
    it 'user_id + media_type の組み合わせはユニークであること' do
      described_class.create!(user: user, media_type: :anime, record_count: 5)
      duplicate = described_class.new(user: user, media_type: :anime, record_count: 3)
      expect(duplicate).not_to be_valid
    end

    it '同一ユーザーで異なるmedia_typeは作成できること' do
      described_class.create!(user: user, media_type: :anime, record_count: 5)
      other = described_class.new(user: user, media_type: :movie, record_count: 4)
      expect(other).to be_valid
    end
  end

  describe 'jsonbカラム' do
    it 'same_media_worksを読み書きできること' do
      works = [{ 'title' => '葬送のフリーレン', 'media_type' => 'anime' }]
      profile = described_class.create!(
        user: user, media_type: :anime, same_media_works: works, record_count: 5
      )
      expect(profile.reload.same_media_works).to eq(works)
    end
  end
end
