import { describe, expect, it } from 'vitest'
import { diffParagraphs, splitParagraphs } from '../src/lib/diff.ts'

describe('splitParagraphs', () => {
  it('按空行分段并去空白段', () => {
    expect(splitParagraphs('A\n\nB\n\n\n  \nC\n')).toEqual(['A', 'B', 'C'])
  })
})

describe('diffParagraphs', () => {
  it('完全一致时无差异', () => {
    const text = '第一段。\n\n第二段。\n\n第三段。'
    expect(diffParagraphs(text, text)).toEqual({ modified: [], added: [], removed: [] })
  })

  it('改写一段计为 modified', () => {
    const diff = diffParagraphs('A\n\n旧的一段\n\nC', 'A\n\n新的一段\n\nC')
    expect(diff.modified).toEqual([{ draft: '旧的一段', final: '新的一段' }])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })

  it('纯删除计为 removed', () => {
    const diff = diffParagraphs('A\n\nB\n\nC', 'A\n\nC')
    expect(diff.removed).toEqual(['B'])
    expect(diff.modified).toEqual([])
    expect(diff.added).toEqual([])
  })

  it('纯新增计为 added', () => {
    const diff = diffParagraphs('A\n\nC', 'A\n\nB\n\nC')
    expect(diff.added).toEqual(['B'])
    expect(diff.removed).toEqual([])
    expect(diff.modified).toEqual([])
  })

  it('两段并一段：1 修改 + 1 删除', () => {
    const diff = diffParagraphs('A\n\nX\n\nY\n\nZ', 'A\n\nW\n\nZ')
    expect(diff.modified).toEqual([{ draft: 'X', final: 'W' }])
    expect(diff.removed).toEqual(['Y'])
    expect(diff.added).toEqual([])
  })
})
