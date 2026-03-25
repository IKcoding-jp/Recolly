# frozen_string_literal: true

class RecordTag < ApplicationRecord
  belongs_to :record
  belongs_to :tag

  # 同一record+tagの重複付与を防ぐ
  validates :tag_id, uniqueness: { scope: :record_id }
end
