import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './errorMessages'

describe('getErrorMessage', () => {
  it('既知のエラーコードに対応する日本語メッセージを返す', () => {
    expect(getErrorMessage('email_already_registered', 'fallback')).toContain('既に')
    expect(getErrorMessage('last_login_method', 'fallback')).toContain('最後のログイン手段')
    expect(getErrorMessage('unauthorized', 'fallback')).toContain('認証')
  })

  it('未知のコードはフォールバックメッセージを返す', () => {
    expect(getErrorMessage('unknown_code', 'これはフォールバック')).toBe('これはフォールバック')
  })

  it('codeがundefinedの場合はフォールバックを返す', () => {
    expect(getErrorMessage(undefined, 'fallback text')).toBe('fallback text')
  })

  it('network_errorコードも辞書に含まれる', () => {
    expect(getErrorMessage('network_error', '')).toContain('ネットワーク')
  })
})
