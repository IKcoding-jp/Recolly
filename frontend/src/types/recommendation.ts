export interface PreferenceScore {
  label: string
  score: number
}

export interface GenreStat {
  media_type: string
  count: number
  avg_rating: number | null
}

export interface TagStat {
  name: string
  count: number
}

export interface RecommendedWork {
  title: string
  media_type: string
  description: string
  cover_url: string | null
  reason: string
  external_api_id: string
  external_api_source: string
  metadata: Record<string, unknown>
}

export interface RecommendationAnalysis {
  summary: string
  preference_scores: PreferenceScore[]
  genre_stats: GenreStat[]
  top_tags: TagStat[]
}

export interface RecommendationData {
  analysis: RecommendationAnalysis | null
  recommended_works: RecommendedWork[]
  challenge_works: RecommendedWork[]
  analyzed_at: string | null
  record_count: number
  required_count?: number
  genre_stats?: GenreStat[]
}

export type RecommendationStatus = 'ready' | 'no_records' | 'insufficient_records' | 'generating'

export interface RecommendationResponse {
  recommendation: RecommendationData | null
  status: RecommendationStatus
}

export interface RefreshResponse {
  message: string
  status: string
}
