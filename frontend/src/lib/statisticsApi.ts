import { request } from './api'
import type { Statistics } from './types'

export const statisticsApi = {
  get(): Promise<Statistics> {
    return request<Statistics>('/statistics')
  },
}
