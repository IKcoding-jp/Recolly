require 'rails_helper'

RSpec.describe MediaProfileRefreshJob, type: :job do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe '#perform' do
    context 'media_typeなし（オーケストレーターモード）' do
      before do
        3.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
        2.times do |i|
          work = Work.create!(title: "映画#{i}", media_type: :movie)
          user.records.create!(work: work, status: :completed, rating: 7)
        end
      end

      it '記録が3件以上のアニメだけジョブをエンキューすること' do
        allow(described_class).to receive(:perform_later)
        described_class.perform_now(user.id)
        expect(described_class).to have_received(:perform_later).with(user.id, 'anime')
      end

      it '記録が3件未満の映画はジョブをエンキューしないこと' do
        allow(described_class).to receive(:perform_later)
        described_class.perform_now(user.id)
        expect(described_class).not_to have_received(:perform_later).with(user.id, 'movie')
      end
    end

    context 'media_typeあり（単一メディア処理モード）' do
      it 'MediaPreferenceAnalyzer#analyze_and_saveを呼び出すこと' do
        analyzer = instance_double(MediaPreferenceAnalyzer, analyze_and_save: nil)
        allow(MediaPreferenceAnalyzer).to receive(:new).with(user, 'anime').and_return(analyzer)

        described_class.perform_now(user.id, 'anime')

        expect(analyzer).to have_received(:analyze_and_save)
      end
    end

    context '存在しないuser_idの場合' do
      it 'エラーを起こさず終了すること' do
        expect { described_class.perform_now(99_999) }.not_to raise_error
      end
    end
  end
end
