import { useState } from 'react'
import type { UserProfile } from '../../lib/types'
import { profileApi } from '../../lib/profileApi'

export const BIO_MAX_LENGTH = 100

export function useBioEdit(
  profile: UserProfile,
  onProfileUpdate?: (updates: Partial<UserProfile>) => void,
) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(profile.bio ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const startEdit = () => {
    setValue(profile.bio ?? '')
    setIsEditing(true)
  }

  const cancel = () => {
    setValue(profile.bio ?? '')
    setError(null)
    setIsEditing(false)
  }

  const save = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const trimmed = value.trim()
      await profileApi.update({ bio: trimmed || '' })
      onProfileUpdate?.({ bio: trimmed || null })
      setIsEditing(false)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return { isEditing, value, setValue, error, isSaving, startEdit, cancel, save }
}
