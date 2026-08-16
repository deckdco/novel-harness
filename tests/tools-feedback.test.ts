/** 偏好反馈循环集成测试：finalize → digest → distill → brief 携带。 */
import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chaptersTool } from '../src/tools/chapters.ts'
import { feedbackTool } from '../src/tools/feedback.ts'
import { chapterBriefTool } from '../src/tools/chapter-brief.ts'
import { makeProject, type Fixture } from './fixtures.ts'

let fixture: Fixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

describe('novel_feedback digest', () => {
  it('无定稿溯源时 entries 为空并提示建档', async () => {
    fixture = makeProject()
    const tool = feedbackTool(fixture.project)
    const result = await tool.execute({ action: 'digest' }, {} as never) as { entries?: unknown[], preferenceBibleNote?: string }
    expect(result.entries).toEqual([])
    expect(result.preferenceBibleNote).toContain('尚无作者偏好档案')
  })

  it('finalize 后 digest 给出修改证据：字数差/段落变更/样本', async () => {
    fixture = makeProject()
    // 补一份 ds 版落选稿，验证 unchosenDrafts 信号
    const dsDir = join(fixture.dir, 'novel/正文/ds 版/卷一·测试卷')
    mkdirSync(dsDir, { recursive: true })
    writeFileSync(join(dsDir, '第004章_你的朋友.md'), '---\nchapter: 4\nvolume: 1\n---\n\n落选稿正文。\n')

    const chapters = chaptersTool(fixture.project)
    await chapters.execute({
      action: 'finalize',
      chapter: 4,
      from: 'cc 版',
      content: '他站在即墨城头。\n\n运盐的船帆已经看不见了，他转身对阿蘅说：明天卖。',
    }, {} as never)

    const tool = feedbackTool(fixture.project)
    const result = await tool.execute({ action: 'digest' }, {} as never) as {
      entries?: Array<Record<string, never>>,
    }
    const entries = result.entries!
    expect(entries).toHaveLength(1)
    const entry = entries[0] as unknown as {
      chapter: number, from: string,
      wordcount: { draft: number, final: number, delta: number },
      changes: { modified: number, added: number, removed: number },
      modifiedSamples: Array<{ draft: string, final: string }>,
      unchosenDrafts: Array<{ variant: string }>,
    }
    expect(entry.chapter).toBe(4)
    expect(entry.from).toBe('cc 版')
    expect(entry.wordcount.draft).toBeGreaterThan(0)
    expect(entry.changes.modified).toBe(1)
    expect(entry.modifiedSamples[0].draft).toContain('即墨城头')
    expect(entry.unchosenDrafts.map(u => u.variant)).toEqual(['ds 版'])
  })

  it('digest 的 render 输出可粘贴反馈包文本', async () => {
    fixture = makeProject()
    const chapters = chaptersTool(fixture.project)
    await chapters.execute({ action: 'finalize', chapter: 4, from: 'cc 版', content: '改写后的定稿正文。' }, {} as never)
    const tool = feedbackTool(fixture.project)
    const result = await tool.execute({ action: 'digest' }, {} as never)
    const rendered = tool.output!.render({ action: 'digest' }, result as never).map(r => ('text' in r ? r.text : '')).join('\n')
    expect(rendered).toContain('作者偏好反馈包')
    expect(rendered).toContain('第4章 · 选自 cc 版 稿')
    expect(rendered).toContain('请执行')
  })
})

describe('novel_feedback distill', () => {
  it('append 建档带日期与定稿进度，此后任务卡自动携带', async () => {
    fixture = makeProject()
    const chapters = chaptersTool(fixture.project)
    await chapters.execute({ action: 'finalize', chapter: 4, from: 'cc 版', content: '定稿正文。' }, {} as never)

    const tool = feedbackTool(fixture.project)
    const saved = await tool.execute({ action: 'distill', content: '1. 多对话，少静态描写；2. 每个场景至少一个物理锚点。' }, {} as never) as { saved?: string, mode?: string }
    expect(saved.mode).toBe('append')
    expect(existsSync(saved.saved!)).toBe(true)
    const raw = readFileSync(saved.saved!, 'utf8')
    expect(raw).toContain('多对话，少静态描写')
    expect(raw).toContain('定稿至第4章')

    // 任务卡注入偏好档案
    const brief = await chapterBriefTool(fixture.project).execute({ chapter: 5 }, {} as never) as { preference?: { content: string | null, note: string } }
    expect(brief!.preference!.content).toContain('多对话，少静态描写')
    expect(brief!.preference!.note).toContain('初稿必须遵守')
  })

  it('replace 模式整档重写', async () => {
    fixture = makeProject()
    const tool = feedbackTool(fixture.project)
    await tool.execute({ action: 'distill', content: '旧规则。' }, {} as never)
    await tool.execute({ action: 'distill', content: '新规则。', mode: 'replace' }, {} as never)
    const path = fixture.project.resolve('作者偏好档案.md')
    const raw = readFileSync(path, 'utf8')
    expect(raw).toContain('新规则。')
    expect(raw).not.toContain('旧规则。')
  })

  it('缺 content 报错', async () => {
    fixture = makeProject()
    const tool = feedbackTool(fixture.project)
    const result = await tool.execute({ action: 'distill' }, {} as never) as { error?: string }
    expect(result.error).toContain('content')
  })
})
