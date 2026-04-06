# Claude APIに送る好み分析プロンプトを組み立てる
class PreferencePromptBuilder
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
      favorites: :favorites_section
    }
    extras = optional.filter_map { |key, method| send(method) if @data[key].any? }
    [base_section, *extras, output_instructions]
  end

  def base_section
    genre_lines = @data[:genre_stats].map { |s| "#{s[:media_type]}: #{s[:count]}件, 平均#{s[:avg_rating]}点" }
    top_lines = @data[:top_rated].map do |w|
      genres = w[:genres].join(', ')
      "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点, ジャンル: #{genres})"
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

  def output_instructions
    "#{json_format_instruction}\n#{genre_distribution_rules}"
  end

  def json_format_instruction
    <<~INSTRUCTIONS
      以下をJSON形式で出力してください。

      {
        "summary": "好み傾向の分析（200字程度）。ジャンルを横断した共通パターンを見つけ、具体的な作品名や感想を引用。定型的な表現を避けること。",
        "preference_scores": [
          { "label": "嗜好の軸名", "score": 1.0〜10.0 }
        ],
        "search_keywords": {
          "recommended": [
            { "media_type": "ジャンル名", "query": "具体的な作品タイトル1つ", "reason": "この作品をおすすめする具体的な理由" }
          ],
          "challenge": [
            { "media_type": "ジャンル名", "query": "具体的な作品タイトル1つ", "reason": "このジャンルに挑戦する理由" }
          ]
        }
      }
    INSTRUCTIONS
  end

  def genre_distribution_rules
    genre_list = @data[:genre_stats].pluck(:media_type).join(', ')

    <<~RULES
      重要なルール:
      - preference_scoresは5項目
      - search_keywordsのrecommendedは7件、challengeは3件
      - queryは「具体的な作品タイトル」を1つだけ指定すること（実在する作品名）
      - reasonは各作品ごとに異なる内容にすること。ユーザーの具体的な作品名・評価を引用する
      - ユーザーの記録ジャンル: #{genre_list}
      - recommendedはジャンル（#{genre_list}）に分散させること。同じジャンルばかりにしない
      - anime/mangaの記録が多いユーザーにはanime/mangaを中心におすすめすること
      - challengeの3件は、ユーザーの記録が少ないジャンルから選ぶこと
      - JSONのみ出力し、それ以外のテキストは含めないでください
    RULES
  end
end
