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

// Google Identity Services (ADR-0035) のログインAPIレスポンス
// 分岐が3系統あるため、discriminated unionで表現する
export type GoogleAuthResponse =
  | { status: 'success'; user: User }
  | { status: 'new_user' }
  | { status: 'error'; code: string; message: string }

export interface ErrorResponse {
  error?: string
  code?: string
  message?: string
  errors?: string[]
}

// メディアジャンル
export type MediaType = 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'

// 記録ステータス
export type RecordStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

// AniList等の外部APIから取得したメタデータ
export interface WorkMetadata {
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
  genres?: string[]
  season_year?: number
  popularity?: number
  title_english?: string
  title_romaji?: string
  // シリーズ作品（Season 2等）で、親作品の日本語説明を流用したことを示すフラグ
  description_from_parent?: boolean
  [key: string]: unknown
}

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
  metadata: WorkMetadata
  last_synced_at: string | null
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
  metadata: WorkMetadata
}

// 記録
export interface UserRecord {
  id: number
  work_id: number
  status: RecordStatus
  rating: number | null
  current_episode: number
  rewatch_count: number
  review_text: string | null
  visibility: 'private_record' | 'public_record'
  started_at: string | null
  completed_at: string | null
  created_at: string
  work: Work
  tags?: Tag[]
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

// 話数感想
export interface EpisodeReview {
  id: number
  record_id: number
  episode_number: number
  body: string
  visibility: 'private_record' | 'public_record'
  created_at: string
  updated_at: string
}

// タグ
export interface Tag {
  id: number
  name: string
  user_id: number
  created_at: string
}

// 統計
// 画像（S3にアップロード済み、DBに登録済み）
export interface ImageRecord {
  id: number
  s3_key: string
  file_name: string
  content_type: string
  file_size: number
  imageable_type: string
  imageable_id: number
  url: string
  created_at: string
}

// 署名付きURL発行レスポンス
export interface PresignResponse {
  presigned_url: string
  s3_key: string
}

// 画像メタデータ登録レスポンス
export interface ImageResponse {
  image: ImageRecord
}

export interface Statistics {
  by_genre: Record<string, number>
  by_status: Record<string, number>
  monthly_completions: Array<{ month: string; count: number }>
  totals: {
    episodes_watched: number
    volumes_read: number
  }
}

// --- フェーズ3: コミュニティ機能 ---

export interface UserSummary {
  id: number
  username: string
  avatar_url: string | null
}

export interface WorkSummary {
  id: number
  title: string
  media_type: MediaType
  total_episodes: number | null
  cover_image_url: string | null
}

export interface Discussion {
  id: number
  title: string
  body: string
  episode_number: number | null
  has_spoiler: boolean
  comments_count: number
  created_at: string
  updated_at: string
  user: UserSummary
  work: WorkSummary
}

export interface DiscussionsResponse {
  discussions: Discussion[]
  meta: PaginationMeta
}

export interface DiscussionResponse {
  discussion: Discussion
}

export interface DiscussionComment {
  id: number
  body: string
  created_at: string
  updated_at: string
  edited: boolean
  user: UserSummary
}

export interface CommentsResponse {
  comments: DiscussionComment[]
  meta: PaginationMeta
}

export interface CommentResponse {
  comment: DiscussionComment
}

export interface UserProfile {
  id: number
  username: string
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface UserStatistics {
  total_records: number
  completed_count: number
  watching_count: number
  average_rating: number | null
  by_genre: Record<string, number>
  by_status: Record<string, number>
}

export interface UserProfileResponse {
  user: UserProfile
  statistics: UserStatistics
}

export interface PublicRecord {
  id: number
  status: RecordStatus
  rating: number | null
  current_episode: number
  updated_at: string
  work: WorkSummary
}

export interface PublicRecordsResponse {
  records: PublicRecord[]
  meta: PaginationMeta
}

// お気に入り作品
export interface FavoriteWorkItem {
  id: number
  position: number
  work: WorkSummary
}

export type FavoriteDisplayMode = 'ranking' | 'favorites'

export interface FavoriteWorksResponse {
  favorite_works: FavoriteWorkItem[]
  display_mode: FavoriteDisplayMode
}
