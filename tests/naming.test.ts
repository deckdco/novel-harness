import { describe, expect, it } from 'vitest'
import { buildChapterFileName, parseChapterFileName } from '../src/lib/naming.ts'

describe('parseChapterFileName', () => {
  it('解析 cc 规范命名 第001章_醒在火上.md', () => {
    expect(parseChapterFileName('第001章_醒在火上.md')).toEqual({ chapter: 1, title: '醒在火上' })
  })

  it('解析 ds 变体 第 1章 · 醒在火上.md', () => {
    expect(parseChapterFileName('第 1章 · 醒在火上.md')).toEqual({ chapter: 1, title: '醒在火上' })
  })

  it('解析 gemini 变体 第 1 章 醒在沸锅.md', () => {
    expect(parseChapterFileName('第 1 章 醒在沸锅.md')).toEqual({ chapter: 1, title: '醒在沸锅' })
  })

  it('解析三位数以上章节号', () => {
    expect(parseChapterFileName('第128章_合纵暗线.md')).toEqual({ chapter: 128, title: '合纵暗线' })
    expect(parseChapterFileName('第1000章_终章.md')).toEqual({ chapter: 1000, title: '终章' })
  })

  it('非章节文件返回 null', () => {
    expect(parseChapterFileName('README.md')).toBeNull()
    expect(parseChapterFileName('卷一·醒在齐宫')).toBeNull()
    expect(parseChapterFileName('设定圣经.md')).toBeNull()
  })
})

describe('buildChapterFileName', () => {
  it('生成规范命名（三位零填充）', () => {
    expect(buildChapterFileName(1, '醒在火上')).toBe('第001章_醒在火上.md')
    expect(buildChapterFileName(42, '卷尾')).toBe('第042章_卷尾.md')
    expect(buildChapterFileName(1000, '终章')).toBe('第1000章_终章.md')
  })

  it('标题中的非法文件名字符被替换', () => {
    expect(buildChapterFileName(3, '倒计时/slash')).toBe('第003章_倒计时-slash.md')
  })

  it('与 parse 往返一致', () => {
    const name = buildChapterFileName(7, '不卖')
    expect(parseChapterFileName(name)).toEqual({ chapter: 7, title: '不卖' })
  })
})
