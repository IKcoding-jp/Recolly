import { describe, it, expect } from 'vitest'
import {
  getActionLabel,
  getProgressText,
  getGenreLabel,
  hasEpisodes,
  getStatusLabel,
  getStatusOptions,
  getRewatchLabel,
} from './mediaTypeUtils'

describe('getActionLabel', () => {
  it('アニメは「+1話」を返す', () => {
    expect(getActionLabel('anime')).toBe('+1話')
  })
  it('ドラマは「+1話」を返す', () => {
    expect(getActionLabel('drama')).toBe('+1話')
  })
  it('漫画は「+1巻」を返す', () => {
    expect(getActionLabel('manga')).toBe('+1巻')
  })
  it('本は「読了」を返す', () => {
    expect(getActionLabel('book')).toBe('読了')
  })
  it('映画は「観た」を返す', () => {
    expect(getActionLabel('movie')).toBe('観た')
  })
  it('ゲームは「クリア」を返す', () => {
    expect(getActionLabel('game')).toBe('クリア')
  })
})

describe('getProgressText', () => {
  it('アニメで話数ありなら「12 / 25話」を返す', () => {
    expect(getProgressText('anime', 12, 25)).toBe('12 / 25話')
  })
  it('漫画で巻数ありなら「89 / 108巻」を返す', () => {
    expect(getProgressText('manga', 89, 108)).toBe('89 / 108巻')
  })
  it('映画は「—」を返す', () => {
    expect(getProgressText('movie', 0, null)).toBe('—')
  })
  it('ゲームは「プレイ中」を返す', () => {
    expect(getProgressText('game', 0, null)).toBe('プレイ中')
  })
  it('本は「読書中」を返す', () => {
    expect(getProgressText('book', 0, null)).toBe('読書中')
  })
  it('アニメでtotal_episodesがnullなら話数部分のみ表示', () => {
    expect(getProgressText('anime', 5, null)).toBe('5話')
  })
})

describe('getGenreLabel', () => {
  it('アニメは「アニメ」を返す', () => {
    expect(getGenreLabel('anime')).toBe('アニメ')
  })
  it('映画は「映画」を返す', () => {
    expect(getGenreLabel('movie')).toBe('映画')
  })
  it('ドラマは「ドラマ」を返す', () => {
    expect(getGenreLabel('drama')).toBe('ドラマ')
  })
  it('本は「本」を返す', () => {
    expect(getGenreLabel('book')).toBe('本')
  })
  it('漫画は「漫画」を返す', () => {
    expect(getGenreLabel('manga')).toBe('漫画')
  })
  it('ゲームは「ゲーム」を返す', () => {
    expect(getGenreLabel('game')).toBe('ゲーム')
  })
})

describe('hasEpisodes', () => {
  it('アニメはtrueを返す', () => {
    expect(hasEpisodes('anime')).toBe(true)
  })
  it('ドラマはtrueを返す', () => {
    expect(hasEpisodes('drama')).toBe(true)
  })
  it('漫画はtrueを返す', () => {
    expect(hasEpisodes('manga')).toBe(true)
  })
  it('映画はfalseを返す', () => {
    expect(hasEpisodes('movie')).toBe(false)
  })
  it('本はfalseを返す', () => {
    expect(hasEpisodes('book')).toBe(false)
  })
  it('ゲームはfalseを返す', () => {
    expect(hasEpisodes('game')).toBe(false)
  })
})

describe('getStatusLabel', () => {
  // 映像系（anime / movie / drama）
  it('アニメの watching は「視聴中」を返す', () => {
    expect(getStatusLabel('watching', 'anime')).toBe('視聴中')
  })
  it('映画の completed は「視聴完了」を返す', () => {
    expect(getStatusLabel('completed', 'movie')).toBe('視聴完了')
  })
  it('ドラマの plan_to_watch は「視聴予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'drama')).toBe('視聴予定')
  })

  // 読み物系（book / manga）
  it('本の watching は「読書中」を返す', () => {
    expect(getStatusLabel('watching', 'book')).toBe('読書中')
  })
  it('漫画の completed は「読了」を返す', () => {
    expect(getStatusLabel('completed', 'manga')).toBe('読了')
  })
  it('本の plan_to_watch は「読書予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'book')).toBe('読書予定')
  })

  // ゲーム
  it('ゲームの watching は「プレイ中」を返す', () => {
    expect(getStatusLabel('watching', 'game')).toBe('プレイ中')
  })
  it('ゲームの completed は「プレイ完了」を返す', () => {
    expect(getStatusLabel('completed', 'game')).toBe('プレイ完了')
  })
  it('ゲームの plan_to_watch は「プレイ予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'game')).toBe('プレイ予定')
  })

  // 共通
  it('on_hold はジャンル問わず「一時停止」を返す', () => {
    expect(getStatusLabel('on_hold', 'anime')).toBe('一時停止')
    expect(getStatusLabel('on_hold', 'book')).toBe('一時停止')
    expect(getStatusLabel('on_hold', 'game')).toBe('一時停止')
  })
  it('dropped はジャンル問わず「中断」を返す', () => {
    expect(getStatusLabel('dropped', 'anime')).toBe('中断')
    expect(getStatusLabel('dropped', 'book')).toBe('中断')
    expect(getStatusLabel('dropped', 'game')).toBe('中断')
  })

  // 汎用（mediaType 未指定）
  it('mediaType 未指定の watching は「進行中」を返す', () => {
    expect(getStatusLabel('watching')).toBe('進行中')
  })
  it('mediaType 未指定の completed は「完了」を返す', () => {
    expect(getStatusLabel('completed')).toBe('完了')
  })
  it('mediaType 未指定の plan_to_watch は「予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch')).toBe('予定')
  })
  it('mediaType が null の場合も汎用ラベルを返す', () => {
    expect(getStatusLabel('watching', null)).toBe('進行中')
  })
})

describe('getStatusOptions', () => {
  it('mediaType 未指定時は汎用ラベルの配列を返す', () => {
    const options = getStatusOptions()
    expect(options[0]).toEqual({ value: null, label: 'すべて' })
    expect(options[1]).toEqual({ value: 'watching', label: '進行中' })
    expect(options[2]).toEqual({ value: 'completed', label: '完了' })
  })

  it('anime 指定時は映像系ラベルの配列を返す', () => {
    const options = getStatusOptions('anime')
    expect(options[1]).toEqual({ value: 'watching', label: '視聴中' })
    expect(options[2]).toEqual({ value: 'completed', label: '視聴完了' })
  })

  it('book 指定時は読み物系ラベルの配列を返す', () => {
    const options = getStatusOptions('book')
    expect(options[1]).toEqual({ value: 'watching', label: '読書中' })
    expect(options[2]).toEqual({ value: 'completed', label: '読了' })
  })

  it('常に6つのオプション（すべて + 5ステータス）を返す', () => {
    expect(getStatusOptions()).toHaveLength(6)
    expect(getStatusOptions('game')).toHaveLength(6)
  })
})

describe('getRewatchLabel', () => {
  it('アニメは「再視聴回数」を返す', () => {
    expect(getRewatchLabel('anime')).toBe('再視聴回数')
  })
  it('映画は「再視聴回数」を返す', () => {
    expect(getRewatchLabel('movie')).toBe('再視聴回数')
  })
  it('ドラマは「再視聴回数」を返す', () => {
    expect(getRewatchLabel('drama')).toBe('再視聴回数')
  })
  it('本は「再読回数」を返す', () => {
    expect(getRewatchLabel('book')).toBe('再読回数')
  })
  it('漫画は「再読回数」を返す', () => {
    expect(getRewatchLabel('manga')).toBe('再読回数')
  })
  it('ゲームは「リプレイ回数」を返す', () => {
    expect(getRewatchLabel('game')).toBe('リプレイ回数')
  })
})
