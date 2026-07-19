import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMediaProfiles } from './useMediaProfiles'
import { mediaPreferenceProfilesApi } from '../lib/mediaPreferenceProfilesApi'

vi.mock('../lib/mediaPreferenceProfilesApi')

const mockProfiles = [
  {
    media_type: 'anime',
    status: 'ready' as const,
    analysis_summary: 'テスト',
    same_media_works: [],
    record_count: 24,
    analyzed_at: '2026-05-09T10:00:00+09:00',
  },
  {
    media_type: 'movie',
    status: 'insufficient_records' as const,
    record_count: 1,
  },
  { media_type: 'drama', status: 'no_records' as const, record_count: 0 },
  { media_type: 'book', status: 'no_records' as const, record_count: 0 },
  { media_type: 'manga', status: 'no_records' as const, record_count: 0 },
  { media_type: 'game', status: 'no_records' as const, record_count: 0 },
]

describe('useMediaProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期状態はisLoading=true', () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    expect(result.current.isLoading).toBe(true)
  })

  it('APIレスポンスをprofilesにセットする', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.profiles).toHaveLength(6)
    expect(result.current.profiles[0].media_type).toBe('anime')
  })

  it('APIエラー時はerrorをセットする', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('getProfileByMediaTypeで特定メディアのプロファイルを取得できる', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const anime = result.current.getProfileByMediaType('anime')
    expect(anime?.status).toBe('ready')
  })
})
