# ユーザーの記録データを集計し、好み分析用のデータを準備する
class PreferenceAnalyzer
  MINIMUM_RECORDS = 5
  MAX_TOP_RATED = 10
  MAX_DROPPED = 5
  MAX_REVIEW_EXCERPTS = 20
  MAX_EXCERPT_LENGTH = 100

  def initialize(user)
    @user = user
    @records = user.records.includes(:work, :tags, :episode_reviews)
  end

  def collect_data
    {
      genre_stats: genre_stats,
      top_rated: top_rated_works,
      dropped: dropped_works,
      tag_stats: tag_stats,
      review_excerpts: review_excerpts,
      favorites: favorite_works
    }
  end

  def analyze
    return nil if @records.count < MINIMUM_RECORDS

    data = collect_data
    response = call_claude_api(data)
    parse_response(response, data)
  end

  private

  def genre_stats
    query_genre_stats.map do |stat|
      {
        media_type: stat.media_type,
        count: stat.count,
        avg_rating: stat.avg_rating&.round(1)&.to_f,
        completed: stat.completed_count,
        dropped: stat.dropped_count
      }
    end
  end

  def query_genre_stats
    completed_case = "SUM(CASE WHEN records.status = #{Record.statuses[:completed]} THEN 1 ELSE 0 END)"
    dropped_case = "SUM(CASE WHEN records.status = #{Record.statuses[:dropped]} THEN 1 ELSE 0 END)"

    Work.joins(:records)
        .where(records: { user_id: @user.id })
        .group('works.media_type')
        .select(
          'works.media_type',
          'COUNT(*) as count',
          'AVG(records.rating) as avg_rating',
          "#{completed_case} as completed_count",
          "#{dropped_case} as dropped_count"
        )
  end

  def top_rated_works
    @records.where.not(rating: nil)
            .order(rating: :desc, updated_at: :desc)
            .limit(MAX_TOP_RATED)
            .map { |r| work_summary(r) }
  end

  def dropped_works
    @records.where(status: :dropped)
            .order(updated_at: :desc)
            .limit(MAX_DROPPED)
            .map { |r| work_summary(r) }
  end

  def tag_stats
    Tag.joins(:record_tags)
       .joins(record_tags: :record)
       .where(records: { user_id: @user.id })
       .group('tags.name')
       .select(
         'tags.name',
         'COUNT(*) as usage_count',
         'AVG(records.rating) as avg_rating'
       )
       .order(usage_count: :desc)
       .limit(10)
       .map do |tag|
         { name: tag.name, count: tag.usage_count, avg_rating: tag.avg_rating&.round(1)&.to_f }
       end
  end

  def review_excerpts
    EpisodeReview.joins(record: :user)
                 .where(records: { user_id: @user.id })
                 .where.not(body: [nil, ''])
                 .order(created_at: :desc)
                 .limit(MAX_REVIEW_EXCERPTS)
                 .pluck(:body)
                 .map { |body| body.truncate(MAX_EXCERPT_LENGTH) }
  end

  def favorite_works
    FavoriteWork.where(user: @user)
                .includes(:work)
                .order(:position)
                .map do |fav|
                  {
                    title: fav.work.title,
                    media_type: fav.work.media_type,
                    genres: fav.work.metadata&.dig('genres') || []
                  }
                end
  end

  def work_summary(record)
    {
      title: record.work.title,
      media_type: record.work.media_type,
      rating: record.rating,
      genres: record.work.metadata&.dig('genres') || []
    }
  end

  def call_claude_api(data)
    client = Anthropic::Client.new(api_key: ENV.fetch('ANTHROPIC_API_KEY'))
    prompt = PreferencePromptBuilder.new(data).build
    client.messages(
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    )
  end

  def parse_response(response, data)
    text = response.dig('content', 0, 'text')
    parsed = JSON.parse(text)

    {
      summary: parsed['summary'],
      preference_scores: parsed['preference_scores'],
      search_keywords: parsed['search_keywords'],
      reasons: parsed['reasons'],
      genre_stats: data[:genre_stats],
      top_tags: data[:tag_stats]
    }
  rescue JSON::ParserError => e
    Rails.logger.error("[PreferenceAnalyzer] JSON解析エラー: #{e.message}")
    nil
  end
end
