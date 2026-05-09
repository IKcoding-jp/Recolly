# メディア別の好み分析を行い、MediaPreferenceProfileに保存する
class MediaPreferenceAnalyzer
  MINIMUM_RECORDS = 3
  MAX_TOP_RATED = 5
  MAX_DROPPED = 3
  MAX_REVIEW_EXCERPTS = 10
  MAX_EXCERPT_LENGTH = 100

  def initialize(user, media_type)
    @user = user
    @media_type = media_type
    @records = user.records.joins(:work)
                   .where(works: { media_type: Work.media_types[@media_type] })
                   .includes(:work, :tags, :episode_reviews)
  end

  def analyze_and_save
    return nil if @records.count < MINIMUM_RECORDS

    data = collect_data
    analysis = call_claude_api(data)
    return nil if analysis.nil?

    works = search_works(analysis)
    save_result(analysis, works)
  end

  private

  def collect_data
    {
      media_type: @media_type,
      record_count: @records.count,
      avg_rating: (@records.average(:rating) || 0.0).round(1).to_f,
      top_rated: top_rated_works,
      dropped: dropped_works,
      tag_stats: tag_stats,
      review_excerpts: review_excerpts,
      favorites: []
    }
  end

  def top_rated_works
    @records.where.not(rating: nil)
            .order(rating: :desc, updated_at: :desc)
            .limit(MAX_TOP_RATED)
            .map { |r| { title: r.work.title, rating: r.rating, genres: r.work.metadata&.dig('genres') || [] } }
  end

  def dropped_works
    @records.where(status: :dropped)
            .order(updated_at: :desc)
            .limit(MAX_DROPPED)
            .map { |r| { title: r.work.title, rating: r.rating } }
  end

  def tag_stats
    Tag.joins(record_tags: { record: :work })
       .where(records: { user_id: @user.id })
       .where(works: { media_type: Work.media_types[@media_type] })
       .group('tags.name')
       .select('tags.name', 'COUNT(*) as usage_count', 'AVG(records.rating) as avg_rating')
       .order(usage_count: :desc)
       .limit(5)
       .map { |t| { name: t.name, count: t.usage_count, avg_rating: t.avg_rating&.round(1)&.to_f } }
  end

  def review_excerpts
    EpisodeReview.joins(record: :work)
                 .where(records: { user_id: @user.id })
                 .where(works: { media_type: Work.media_types[@media_type] })
                 .where.not(body: [nil, ''])
                 .order(created_at: :desc)
                 .limit(MAX_REVIEW_EXCERPTS)
                 .pluck(:body)
                 .map { |body| body.truncate(MAX_EXCERPT_LENGTH) }
  end

  def call_claude_api(data)
    client = Anthropic::Client.new(api_key: ENV.fetch('ANTHROPIC_API_KEY'))
    prompt = MediaPreferencePromptBuilder.new(data).build
    response = client.messages.create(
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    )
    parse_response(response)
  rescue StandardError => e
    Rails.logger.error("[MediaPreferenceAnalyzer] #{@media_type}のClaude API呼び出し失敗: #{e.message}")
    nil
  end

  def parse_response(response)
    text = response.content[0].text.strip
    text = text.sub(/\A```json\s*\n?/, '').sub(/\n?```\s*\z/, '')
    JSON.parse(text)
  rescue JSON::ParserError => e
    Rails.logger.error("[MediaPreferenceAnalyzer] JSON解析エラー: #{e.message}")
    nil
  end

  def search_works(analysis)
    same_keywords = (analysis['same_media_keywords'] || []).map { |k| k.merge('media_type' => @media_type) }
    cross_keywords = analysis['cross_media_keywords'] || []
    adapted = { search_keywords: { 'recommended' => same_keywords, 'challenge' => cross_keywords } }
    WorkRecommender.new(@user, adapted).recommend
  end

  def save_result(analysis, works)
    attributes = {
      analysis_summary: analysis['summary'],
      preference_scores: analysis['preference_scores'] || [],
      top_tags: [],
      same_media_works: stringify_keys(works[:recommended_works]),
      cross_media_works: stringify_keys(works[:challenge_works]),
      record_count: @records.count,
      analyzed_at: Time.current
    }
    profile = MediaPreferenceProfile.find_or_initialize_by(user: @user, media_type: @media_type)
    profile.update!(attributes)
    profile
  end

  def stringify_keys(array)
    array.map { |item| item.transform_keys(&:to_s) }
  end
end
