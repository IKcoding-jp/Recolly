class MediaPreferenceProfile < ApplicationRecord
  belongs_to :user

  enum :media_type, {
    anime: 0,
    movie: 1,
    drama: 2,
    book: 3,
    manga: 4,
    game: 5
  }

  validates :media_type, presence: true
  validates :user_id, uniqueness: { scope: :media_type }
end
