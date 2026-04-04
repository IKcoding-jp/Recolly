// frontend/src/hooks/useLayoutPreference.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutPreference } from './useLayoutPreference'

const STORAGE_KEY = 'recolly-library-layout'

describe('useLayoutPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localStorageに値がないときはlistを返す', () => {
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('list')
  })

  it('localStorageに保存された値を読み込む', () => {
    localStorage.setItem(STORAGE_KEY, 'card')
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('card')
  })

  it('setLayoutでレイアウトを変更しlocalStorageに保存する', () => {
    const { result } = renderHook(() => useLayoutPreference())

    act(() => {
      result.current.setLayout('compact')
    })

    expect(result.current.layout).toBe('compact')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('compact')
  })

  it('不正な値がlocalStorageにある場合はlistにフォールバックする', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-value')
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('list')
  })
})
