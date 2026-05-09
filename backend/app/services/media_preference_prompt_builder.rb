# メディア別好み分析のClaude APIプロンプトを組み立てる
class MediaPreferencePromptBuilder
  MEDIA_TYPE_JA = {
    'anime' => 'アニメ',
    'movie' => '映画',
    'drama' => 'ドラマ',
    'book' => '本',
    'manga' => '漫画',
    'game' => 'ゲーム'
  }.freeze

  def initialize(data)
    @data = data
  end

  def build
    collect_sections.join("\n")
  end

  private

  def collect_sections
    media_ja = MEDIA_TYPE_JA[@data[:media_type]] || @data[:media_type]
    optional = {
      dropped: :dropped_section,
      tag_stats: :tags_section,
      review_excerpts: :reviews_section,
      favorites: :favorites_section
    }
    extras = optional.filter_map { |key, method| send(method) if @data[key].any? }
    [base_section(media_ja), *extras, output_instructions(media_ja)]
  end

  def base_section(media_ja)
    top_lines = @data[:top_rated].map do |w|
      genres = w[:genres].join(', ')
      "#{w[:title]} (#{w[:rating]}点, ジャンル: #{genres})"
    end

    <<~PROMPT
      あなたはメディア作品のレコメンドアナリストです。
      以下は「#{media_ja}」ジャンルのみの記録データです。

      ■ 記録統計: #{@data[:record_count]}件 / 平均#{@data[:avg_rating]}点

      ■ 高評価作品TOP5:
      #{top_lines.join("\n")}
    PROMPT
  end

  def dropped_section
    lines = @data[:dropped].map { |w| "#{w[:title]} (#{w[:rating]}点)" }
    <<~SECTION
      ■ 断念した作品:
      #{lines.join("\n")}
    SECTION
  end

  def tags_section
    lines = @data[:tag_stats].map { |t| "#{t[:name]} (#{t[:count]}回使用, 平均#{t[:avg_rating]}点)" }
    <<~SECTION
      ■ よく使うタグ:
      #{lines.join("\n")}
    SECTION
  end

  def reviews_section
    lines = @data[:review_excerpts].map { |r| "「#{r}」" }
    <<~SECTION
      ■ 感想テキスト抜粋:
      #{lines.join("\n")}
    SECTION
  end

  def favorites_section
    lines = @data[:favorites].map { |f| "#{f[:title]} (ジャンル: #{f[:genres].join(', ')})" }
    <<~SECTION
      ■ お気に入り作品:
      #{lines.join("\n")}
    SECTION
  end

  def output_instructions(media_ja)
    other_media = (MEDIA_TYPE_JA.keys - [@data[:media_type]]).map { |k| MEDIA_TYPE_JA[k] }.join(', ')
    "#{json_format(media_ja, other_media)}\n#{rules(media_ja, other_media)}"
  end

  def json_format(media_ja, other_media)
    <<~JSON
      以下をJSON形式で出力してください。

      {
        "summary": "#{media_ja}での好み傾向（200字程度）。具体的な作品名や感想を引用すること。",
        "preference_scores": [{ "label": "嗜好の軸名", "score": 1.0〜10.0 }],
        "same_media_keywords": [
          { "query": "具体的な#{media_ja}作品タイトル1つ", "reason": "おすすめ理由（ユーザーの作品名・評価を引用）" }
        ],
        "cross_media_keywords": [
          { "media_type": "#{other_media}のいずれか", "query": "具体的な作品タイトル1つ", "reason": "#{media_ja}好みから他メディアをおすすめする理由" }
        ]
      }
    JSON
  end

  def rules(media_ja, other_media)
    <<~RULES
      重要なルール:
      - preference_scoresは5項目
      - same_media_keywordsは5件（queryは実在する#{media_ja}作品タイトル）
      - cross_media_keywordsは3件（queryは実在する作品タイトル、media_typeは#{other_media}から選ぶ）
      - reasonは各作品ごとに異なる内容にすること
      - JSONのみ出力し、それ以外のテキストは含めないでください
    RULES
  end
end
