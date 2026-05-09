import type { RecommendedWork } from './recommendation'

export type MediaProfileStatus = 'ready' | 'insufficient_records' | 'no_records' | 'generating'

export interface MediaPreferenceScore {
  label: string
  score: number
}

export interface MediaPreferenceProfileReady {
  media_type: string
  status: 'ready'
  analysis_summary: string
  preference_scores: MediaPreferenceScore[]
  top_tags: Array<{ name: string; count: number }>
  same_media_works: RecommendedWork[]
  cross_media_works: RecommendedWork[]
  record_count: number
  analyzed_at: string
}

export interface MediaPreferenceProfileInsufficient {
  media_type: string
  status: 'insufficient_records'
  record_count: number
  required_count: number
}

export interface MediaPreferenceProfileEmpty {
  media_type: string
  status: 'no_records' | 'generating'
  record_count: number
}

export type MediaPreferenceProfile =
  | MediaPreferenceProfileReady
  | MediaPreferenceProfileInsufficient
  | MediaPreferenceProfileEmpty
