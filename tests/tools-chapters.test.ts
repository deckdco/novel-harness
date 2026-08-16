/** chapters 工具 create/save 写入路径测试（临时目录，不碰真实项目）。 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { chaptersTool } from '../src/tools/chapters.ts'
import { makeProject, type Fixture } from './fixtures.ts'

let fixture: Fixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

describe('novel_chapters create/save', () => {
  it('create 建规范命名文件与完整 frontmatter', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const result = await tool.execute({ action: 'create', chapter: 4, title: '朝堂初入' }, {} as never) as { created?: string }
    expect(result.created).toContain('第004章_朝堂初入.md')
    expect(result.created).toContain('卷一·测试卷')
    const raw = readFileSync(result.created!, 'utf8')
    expect(raw).toContain('chapter: 4')
    expect(raw).toContain('status: draft-v1')
    expect(raw).toContain('volume: 1')
    expect(raw).toContain('hooks: []')
  })

  it('create 拒绝覆盖已有文件', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const result = await tool.execute({ action: 'create', chapter: 1, title: '醒在火上' }, {} as never) as { error?: string }
    expect(result.error).toContain('已存在')
  })

  it('save 写入正文并自动统计字数、解析钩子/roles 标注', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const result = await tool.execute({
      action: 'save',
      chapter: 4,
      title: '朝堂初入',
      content: '苏代走进朝堂。他数了数殿上的铜灯。',
      status: 'draft-v2',
      summary: '苏代初入朝堂',
      hooks: '信息钩-殿上灯数；情感钩-殿外苏秦',
      roles: '苏代；苏秦',
    }, {} as never) as { saved?: string, wordcount?: number }
    expect(result.wordcount).toBe(15)
    const raw = readFileSync(result.saved!, 'utf8')
    expect(raw).toContain('wordcount: 15')
    expect(raw).toContain('status: draft-v2')
    expect(raw).toContain('hooks: [信息钩-殿上灯数, 情感钩-殿外苏秦]')
    expect(raw).toContain('roles: [苏代, 苏秦]')
    expect(raw).toContain('苏代走进朝堂。')
  })

  it('save 更新已有章节保留 created 与 tags', async () => {
    fixture = makeProject()
    const before = fixture.project.chapters('cc 版')[0]
    const original = readFileSync(before.path, 'utf8')
    const tool = chaptersTool(fixture.project)
    await tool.execute({ action: 'save', chapter: 1, content: '全新的第一章正文。' }, {} as never)
    const after = readFileSync(before.path, 'utf8')
    expect(after).toContain('全新的第一章正文。')
    expect(after).toContain('chapter: 1')
    expect(original).not.toContain('全新的第一章正文。')
  })
})
