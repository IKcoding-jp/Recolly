import type { RecommendedWork } from './recommendation'

export type MediaProfileStatus = 'ready' | 'generating' | 'insufficient_records' | 'no_records'

export interface MediaPreferenceProfileReady {
  media_type: string
  status: 'ready'
  analysis_summary: string
  same_media_works: RecommendedWork[]
  record_count: number
  analyzed_at: string
}

export interface MediaPreferenceProfileGenerating {
  media_type: string
  status: 'generating'
  record_count: number
}

// 全体の記録が5件未満のときにAPIが返す状態（タブ自体は表示されない）
export interface MediaPreferenceProfilePending {
  media_type: string
  status: 'insufficient_records' | 'no_records'
  record_count: number
}

export type MediaPreferenceProfile =
  MediaPreferenceProfileReady | MediaPreferenceProfileGenerating | MediaPreferenceProfilePending
