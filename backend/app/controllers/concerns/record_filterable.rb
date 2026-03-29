# frozen_string_literal: true

# Records の一覧取得におけるフィルタリング・ソートロジック
module RecordFilterable
  extend ActiveSupport::Concern

  private

  def apply_filters(records)
    records = filter_by_status(records)
    records = filter_by_media_type(records)
    records = filter_by_work_id(records)
    filter_by_tags(records)
  end

  def filter_by_status(records)
    return records if params[:status].blank?

    records.where(status: params[:status])
  end

  def filter_by_media_type(records)
    return records if params[:media_type].blank?

    records.joins(:work).where(works: { media_type: params[:media_type] })
  end

  def filter_by_work_id(records)
    return records if params[:work_id].blank?

    records.where(work_id: params[:work_id])
  end

  def filter_by_tags(records)
    return records if params[:tag].blank?

    # 複数タグ指定時はAND条件（全タグを持つ記録のみ）
    tag_names = Array(params[:tag])
    tag_names.each do |tag_name|
      tag_record_ids = RecordTag.joins(:tag)
                                .where(tags: { name: tag_name, user_id: current_user.id })
                                .select(:record_id)
      records = records.where(id: tag_record_ids)
    end
    records
  end

  def apply_sort(records)
    case params[:sort]
    when 'rating'
      records.order(rating: :desc)
    when 'rating_asc'
      records.order(rating: :asc)
    when 'title'
      records.joins(:work).order('works.title DESC')
    when 'title_asc'
      records.joins(:work).order('works.title ASC')
    when 'updated_at_asc'
      records.order(updated_at: :asc)
    else
      records.order(updated_at: :desc)
    end
  end
end
