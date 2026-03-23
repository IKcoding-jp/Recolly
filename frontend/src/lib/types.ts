// ユーザー情報の型定義（バックエンドのJSON表現と一致）
export interface User {
  id: number
  username: string
  email: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  has_password: boolean
  providers: string[]
  email_missing: boolean
}

// API レスポンスの型定義
export interface AuthResponse {
  user: User
}

export interface ErrorResponse {
  error?: string
  errors?: string[]
}

// メディアジャンル
export type MediaType = 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'

// 記録ステータス
export type RecordStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

// 作品（DBに保存済み）
export interface Work {
  id: number
  title: string
  media_type: MediaType
  description: string | null
  cover_image_url: string | null
  total_episodes: number | null
  external_api_id: string | null
  external_api_source: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// 検索結果（外部APIからの結果、DB未保存）
export interface SearchResult {
  title: string
  media_type: MediaType
  description: string | null
  cover_image_url: string | null
  total_episodes: number | null
  external_api_id: string | null
  external_api_source: string | null
  metadata: Record<string, unknown>
}

// 記録
export interface UserRecord {
  id: number
  work_id: number
  status: RecordStatus
  rating: number | null
  current_episode: number
  rewatch_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  work: Work
}

// API レスポンス型
export interface SearchResponse {
  results: SearchResult[]
}

export interface WorkResponse {
  work: Work
}

export interface RecordResponse {
  record: UserRecord
}

// ページネーション情報
export interface PaginationMeta {
  current_page: number
  total_pages: number
  total_count: number
  per_page: number
}

// 記録一覧レスポンス
export interface RecordsListResponse {
  records: UserRecord[]
  meta?: PaginationMeta
}
