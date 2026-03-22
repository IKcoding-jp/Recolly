import { describe, it, expect } from 'vitest'
import { getActionLabel, getProgressText, getGenreLabel, hasEpisodes } from './mediaTypeUtils'

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
