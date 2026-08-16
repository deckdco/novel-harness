import { describe, expect, it } from 'vitest'
import { serializeFrontmatter, splitFrontmatter, updateFrontmatter } from '../src/lib/frontmatter.ts'

const REAL_CC = `---
type: 正文
tags: [齐国大航海, 存道, 正文, 卷一, 第一章, cc版v3]
status: draft-v3
created: 2026-08-15
summary: 苏代穿越醒于大夫府，流民砸门报粮价暴动，以即墨假牌破逼空，宫门口苏秦一句灭宋冻结所有侥幸
chapter: 1
volume: 1
wordcount: 2800
hooks: [死亡倒计时开头, 信息钩-即墨假牌操作, 情感钩-苏秦宫门等待, 炸弹钩-灭宋宣布]
---

# 第一章 醒在火上

苏代是被撞门声震醒的。`

describe('splitFrontmatter', () => {
  it('解析真实 cc 版 frontmatter', () => {
    const parsed = splitFrontmatter(REAL_CC)!
    expect(parsed.data.type).toBe('正文')
    expect(parsed.data.tags).toEqual(['齐国大航海', '存道', '正文', '卷一', '第一章', 'cc版v3'])
    expect(parsed.data.status).toBe('draft-v3')
    expect(parsed.data.created).toBe('2026-08-15')
    expect(parsed.data.summary).toContain('苏代穿越')
    expect(parsed.data.chapter).toBe(1)
    expect(parsed.data.volume).toBe(1)
    expect(parsed.data.wordcount).toBe(2800)
    expect(parsed.data.hooks).toHaveLength(4)
    expect(parsed.body).toContain('# 第一章 醒在火上')
  })

  it('无 frontmatter 时返回 null', () => {
    expect(splitFrontmatter('# 第一章\n\n正文')).toBeNull()
    expect(splitFrontmatter('')).toBeNull()
  })

  it('ds/gemini 版纯正文返回 null', () => {
    expect(splitFrontmatter('\n第一章 醒在火上\n\n苏代是被撞门声震醒的。')).toBeNull()
  })

  it('空数组与单元素数组', () => {
    const parsed = splitFrontmatter('---\nhooks: []\ntags: [一个]\n---\n正文')!
    expect(parsed.data.hooks).toEqual([])
    expect(parsed.data.tags).toEqual(['一个'])
  })
})

describe('serializeFrontmatter + 往返', () => {
  it('序列化后再解析结果一致', () => {
    const parsed = splitFrontmatter(REAL_CC)!
    const out = serializeFrontmatter(parsed.data)
    const reparsed = splitFrontmatter(`---\n${out}---\n\n正文`)!
    expect(reparsed.data).toEqual(parsed.data)
  })

  it('序列化格式保持插入顺序与 cc 版行内数组风格', () => {
    const out = serializeFrontmatter({ type: '正文', chapter: 1, hooks: ['死亡倒计时开头', '信息钩'] })
    expect(out).toBe('type: 正文\nchapter: 1\nhooks: [死亡倒计时开头, 信息钩]\n')
  })
})

describe('updateFrontmatter', () => {
  it('合并 patch 并保留正文', () => {
    const updated = updateFrontmatter(REAL_CC, { status: 'final', wordcount: 3000 })
    const parsed = splitFrontmatter(updated)!
    expect(parsed.data.status).toBe('final')
    expect(parsed.data.wordcount).toBe(3000)
    expect(parsed.data.chapter).toBe(1)
    expect(parsed.body).toContain('苏代是被撞门声震醒的')
  })

  it('可新增字段', () => {
    const updated = updateFrontmatter(REAL_CC, { reviewed: 1 })
    expect(splitFrontmatter(updated)!.data.reviewed).toBe(1)
  })
})
