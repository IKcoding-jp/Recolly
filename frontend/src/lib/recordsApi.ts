import type { RecordResponse, SearchResult } from './types'
import { request } from './api'

export const recordsApi = {
  createFromWorkId(workId: number): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_id: workId } }),
    })
  },

  createFromSearchResult(
    workData: Pick<
      SearchResult,
      | 'title'
      | 'media_type'
      | 'description'
      | 'cover_image_url'
      | 'total_episodes'
      | 'external_api_id'
      | 'external_api_source'
    >,
  ): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_data: workData } }),
    })
  },
}
