import { afterEach, describe, expect, it } from 'vitest'
import { buildRecap } from '../src/lib/recap.ts'
import { makeProject, type Fixture } from './fixtures.ts'

let fixture: Fixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

describe('buildRecap', () => {
  it('近章用 summary 详摘，不含当前章', () => {
    const f = makeProject()
    fixture = f
    const recap = buildRecap(f.project, 4, 5)
    expect(recap.near.map(n => n.chapter)).toEqual([1, 2, 3])
    expect(recap.near[0].summary).toContain('第1章摘要')
  })

  it('近窗外的章进 far 按卷粗摘', () => {
    const f = makeProject({ 4: { body: '第四章。' }, 5: { body: '第五章。' }, 6: { body: '第六章。' } })
    fixture = f
    const recap = buildRecap(f.project, 7, 2)
    expect(recap.near.map(n => n.chapter)).toEqual([5, 6])
    expect(recap.far).toHaveLength(1)
    expect(recap.far[0].volumeLabel).toBe('卷一')
    expect(recap.far[0].written).toBe(4)
    expect(recap.far[0].digest).toContain('Ch1')
  })

  it('无前章时 near/far 均空', () => {
    const f = makeProject()
    fixture = f
    const recap = buildRecap(f.project, 1, 5)
    expect(recap.near).toHaveLength(0)
    expect(recap.far).toHaveLength(0)
  })

  it('前情提要只读定稿：cc 版草稿不算已发生剧情', () => {
    const f = makeProject() // cc 版有第4章草稿，定稿只有 1–3
    fixture = f
    const recap = buildRecap(f.project, 5, 5)
    expect(recap.near.map(n => n.chapter)).toEqual([1, 2, 3])
    expect(JSON.stringify(recap)).not.toContain('cc 版草稿正文')
  })
})
