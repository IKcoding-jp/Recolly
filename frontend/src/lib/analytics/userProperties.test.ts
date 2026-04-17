import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateMediaTypesCount } from './userProperties'
import { setUserProperty } from './posthog'
import { usersApi } from '../usersApi'

vi.mock('./posthog', () => ({
  setUserProperty: vi.fn(),
}))

vi.mock('../usersApi', () => ({
  usersApi: {
    getMyMediaTypes: vi.fn(),
  },
}))

describe('updateMediaTypesCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('API のレスポンス長を distinct_media_types_count として setUserProperty に渡す', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockResolvedValue({
      media_types: ['anime', 'book', 'movie'],
    })
    await updateMediaTypesCount()
    expect(setUserProperty).toHaveBeenCalledWith({ distinct_media_types_count: 3 })
  })

  it('媒体が 0 のときは 0 を送る', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockResolvedValue({ media_types: [] })
    await updateMediaTypesCount()
    expect(setUserProperty).toHaveBeenCalledWith({ distinct_media_types_count: 0 })
  })

  it('API 失敗時はサイレントに握りつぶす（例外を投げない）', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockRejectedValue(new Error('network error'))
    await expect(updateMediaTypesCount()).resolves.toBeUndefined()
    expect(setUserProperty).not.toHaveBeenCalled()
  })
})
