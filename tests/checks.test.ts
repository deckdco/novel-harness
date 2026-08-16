import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { checkAnachronism, checkGolden3, checkHooksCoverage, checkPacing, checkToolman } from '../src/checks/index.ts'
import type { CheckContext } from '../src/checks/index.ts'
import { makeProject, type Fixture } from './fixtures.ts'

let fixture: Fixture | null = null

function context(): CheckContext {
  const f = fixture ?? (fixture = makeProject())
  return { project: f.project, chapters: f.project.chapters('定稿') }
}

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

describe('anachronism', () => {
  it('命中 纸/皇上/玉米 并带上下文', () => {
    const report = checkAnachronism(context())
    const words = report.findings.map(f => f.message).join('\n')
    expect(words).toContain('纸')
    expect(words).toContain('皇上')
    expect(words).toContain('玉米')
    expect(report.findings.every(f => f.message.includes('上下文') || f.message.includes('第1章'))).toBe(true)
  })

  it('白名单短语内的命中被豁免，短语外的仍报', () => {
    fixture = makeProject({
      1: { body: '他想起了纸上谈兵的典故，又看到一张纸。' },
    })
    const report = checkAnachronism(context())
    const paperHits = report.findings.filter(f => f.message.includes('出现"纸"'))
    expect(paperHits).toHaveLength(1)
    expect(paperHits[0].message).toContain('一张纸')
  })

  it('现代金融术语报 warn 级', () => {
    fixture = makeProject({ 2: { body: '他在内心盘算着做空齐国。' } })
    const report = checkAnachronism(context())
    const hit = report.findings.find(f => f.message.includes('做空'))
    expect(hit?.level).toBe('warn')
  })
})

describe('hooks-coverage', () => {
  it('全部章节无 hooks 标注时报连续红线', () => {
    const report = checkHooksCoverage(context())
    expect(report.findings.some(f => f.level === 'error' && f.message.includes('连续'))).toBe(true)
    expect(report.prompts[0]).toContain('五类章尾钩子')
  })

  it('有 hooks 标注的章节不报', () => {
    const f = makeProject()
    const path = f.project.chapters('定稿')[0].path
    const raw = readFileSync(path, 'utf8')
    writeFileSync(path, raw.replace('volume: 1', 'volume: 1\nhooks: [信息钩-测试]'))
    f.project.invalidateChapters()
    fixture = f
    const report = checkHooksCoverage({ project: f.project, chapters: f.project.chapters('定稿') })
    expect(report.findings.filter(m => m.level === 'error')).toHaveLength(0)
  })
})

describe('pacing', () => {
  it('字数不足报警并输出字数序列', () => {
    const report = checkPacing(context())
    expect(report.findings.some(f => f.level === 'warn' && f.message.includes('低于'))).toBe(true)
    expect(report.findings.some(f => f.level === 'info' && f.message.includes('字数序列'))).toBe(true)
    expect(report.prompts.join()).toContain('节奏五问')
  })
})

describe('golden3', () => {
  it('覆盖第1章时产出六问 prompt', () => {
    const report = checkGolden3(context())
    expect(report.prompts.join()).toContain('六问')
  })

  it('不含1–3章时跳过', () => {
    const f = makeProject()
    const chapters = f.project.chapters('定稿').slice(0, 0)
    fixture = f
    const report = checkGolden3({ project: f.project, chapters })
    expect(report.findings[0].message).toContain('跳过')
  })
})

describe('toolman', () => {
  it('无 roles 标注时统计为空但仍给出三问', () => {
    const report = checkToolman(context())
    expect(report.prompts.join()).toContain('工具人三问')
  })
})
