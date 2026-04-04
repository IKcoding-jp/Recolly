// レイアウト切り替えの設定をlocalStorageに永続化するカスタムフック
import { useState, useCallback } from 'react'

export type LayoutType = 'list' | 'card' | 'compact'

const STORAGE_KEY = 'recolly-library-layout'
const VALID_LAYOUTS: LayoutType[] = ['list', 'card', 'compact']

/** localStorageからレイアウト設定を読み込む。不正な値はlistにフォールバックする */
function readLayout(): LayoutType {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && VALID_LAYOUTS.includes(stored as LayoutType)) {
    return stored as LayoutType
  }
  return 'list'
}

export function useLayoutPreference() {
  const [layout, setLayoutState] = useState<LayoutType>(readLayout)

  const setLayout = useCallback((newLayout: LayoutType) => {
    setLayoutState(newLayout)
    localStorage.setItem(STORAGE_KEY, newLayout)
  }, [])

  return { layout, setLayout }
}
