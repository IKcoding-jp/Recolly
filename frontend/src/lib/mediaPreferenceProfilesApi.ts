import { request } from './api'
import type { MediaPreferenceProfile } from '../types/mediaPreferenceProfile'

export const mediaPreferenceProfilesApi = {
  getAll(): Promise<MediaPreferenceProfile[]> {
    return request<MediaPreferenceProfile[]>('/media_preference_profiles')
  },
}
