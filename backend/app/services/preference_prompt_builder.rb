# Claude APIに送る一括好み分析プロンプトを組み立てる
# 総合分析と全6メディア分のおすすめを1回の呼び出しで出力させる（一括生成方式）
class PreferencePromptBuilder
  MEDIA_TYPE_JA = {
    'anime' => 'アニメ',
    'movie' => '映画',
    'drama' => 'ドラマ',
    'book' => '本',
    'manga' => '漫画・ラノベ',
    'game' => 'ゲーム'
  }.freeze

  # 検索での実在確認で落ちる分の保険として、採用数（5件）より多めに提案させる
  PROPOSALS_PER_MEDIA = 8

  def initialize(data)
    @data = data
  end

  def build
    collect_sections.join("\n")
  end

  private

  def collect_sections
    optional = {
      dropped: :dropped_section,
      tag_stats: :tags_section,
      review_excerpts: :reviews_section,
      favorites: :favorites_section,
      recorded_titles: :recorded_titles_section
    }
    extras = optional.filter_map { |key, method| send(method) if @data[key].any? }
    [base_section, *extras, output_instructions]
  end

  def base_section
    genre_lines = @data[:genre_stats].map { |s| "#{s[:media_type]}: #{s[:count]}件, 平均#{s[:avg_rating]}点" }
    top_lines = @data[:top_rated].map do |w|
      "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点, ジャンル: #{w[:genres].join(', ')})"
    end

    <<~PROMPT
      あなたはメディア作品のレコメンドアナリストです。
      以下のユーザーの視聴・閲覧記録データを分析してください。

      ■ ジャンル別統計:
      #{genre_lines.join("\n")}

      ■ 高評価作品TOP10:
      #{top_lines.join("\n")}
    PROMPT
  end

  def dropped_section
    lines = @data[:dropped].map { |w| "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点)" }
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
    lines = @data[:favorites].map { |f| "#{f[:title]} (#{f[:media_type]}, ジャンル: #{f[:genres].join(', ')})" }
    <<~SECTION
      ■ お気に入り作品:
      #{lines.join("\n")}
    SECTION
  end

  def recorded_titles_section
    <<~SECTION
      ■ 記録済みの全作品（おすすめから除外すること）:
      #{@data[:recorded_titles].join(' / ')}
    SECTION
  end

  def output_instructions
    "#{json_format_instruction}\n#{rules}"
  end

  def json_format_instruction
    media_entries = MEDIA_TYPE_JA.map do |key, ja|
      %(    "#{key}": { "trend": "#{ja}での傾向・推薦方針（1〜2文）", ) +
        %("works": [{ "query": "実在する#{ja}作品タイトル1つ", "reason": "おすすめ理由" }] })
    end.join(",\n")

    <<~INSTRUCTIONS
      以下をJSON形式で出力してください。

      {
        "summary": "好み傾向の分析（200字程度）。ジャンルを横断した共通パターンを見つけ、具体的な作品名や感想を引用。定型的な表現を避けること。",
        "preference_scores": [
          { "label": "嗜好の軸名", "score": 1.0〜10.0 }
        ],
        "media_recommendations": {
      #{media_entries}
        }
      }
    INSTRUCTIONS
  end

  def rules
    <<~RULES
      重要なルール:
      - preference_scoresは5項目
      - media_recommendationsは全6メディア（#{MEDIA_TYPE_JA.keys.join(', ')}）を必ず含める
      - 各メディアのworksは#{PROPOSALS_PER_MEDIA}件。queryは実在する作品タイトルを1つだけ指定すること
      - 記録が無いメディアも、他メディアの記録から好みを推定して提案すること（trendにその推定根拠を書く）
      - 記録済み作品と、その派生作品（OVA・特別篇・劇場版総集編・CM・スピンオフ短編）は提案しないこと
      - reasonは各作品ごとに異なる内容にし、ユーザーの具体的な作品名・評価を引用すること
      - JSONのみ出力し、それ以外のテキストは含めないでください
    RULES
  end
end
