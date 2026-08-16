import { describe, expect, it } from 'vitest'
import { findSection, searchSections, splitSections } from '../src/lib/sections.ts'

const DOC = `# 方法论

## 一、起点适配
起点历史频道内容。

### 1.1 特殊性
详细内容。

## 十、《存道》专用的写作纪律
内化不显示。`

describe('splitSections', () => {
  const sections = splitSections(DOC)

  it('切出全部标题并保留父路径', () => {
    expect(sections).toHaveLength(4)
    const s11 = sections.find(s => s.heading.startsWith('1.1'))!
    expect(s11.path).toEqual(['方法论', '一、起点适配'])
    expect(s11.content).toContain('详细内容')
  })

  it('同级标题切断内容边界', () => {
    const s1 = sections.find(s => s.heading === '一、起点适配')!
    expect(s1.content).not.toContain('十、')
  })
})

describe('searchSections', () => {
  it('标题命中排在正文命中前', () => {
    const hits = searchSections(splitSections(DOC + '\n## 其他\n正文提到写作纪律一词'), '写作纪律')
    expect(hits[0].heading).toContain('十、')
  })
})

describe('findSection', () => {
  it('按标题关键词定位', () => {
    expect(findSection(splitSections(DOC), '十、')!.heading).toContain('写作纪律')
    expect(findSection(splitSections(DOC), '不存在')).toBeNull()
  })
})
