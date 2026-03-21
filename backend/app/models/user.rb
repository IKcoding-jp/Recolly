# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :records, dependent: :destroy

  validates :username, presence: true, uniqueness: true,
                       length: { minimum: 2, maximum: 30 }
end
