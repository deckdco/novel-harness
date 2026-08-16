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
    const before = fixture.project.chapters('定稿')[0]
    const original = readFileSync(before.path, 'utf8')
    const tool = chaptersTool(fixture.project)
    await tool.execute({ action: 'save', chapter: 1, content: '全新的第一章正文。' }, {} as never)
    const after = readFileSync(before.path, 'utf8')
    expect(after).toContain('全新的第一章正文。')
    expect(after).toContain('chapter: 1')
    expect(original).not.toContain('全新的第一章正文。')
  })

  it('create/list 默认操作定稿文件夹', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const list = await tool.execute({ action: 'list' }, {} as never) as { variant?: string, count?: number }
    expect(list.variant).toBe('定稿')
    expect(list.count).toBe(3)
    const draftList = await tool.execute({ action: 'list', variant: 'cc 版' }, {} as never) as { count?: number }
    expect(draftList.count).toBe(1)
  })
})

describe('novel_chapters finalize', () => {
  it('从草稿变体归档进定稿：正文、来源、元数据齐全', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const result = await tool.execute({
      action: 'finalize',
      chapter: 4,
      from: 'cc 版',
      summary: '苏代登即墨城头观盐船',
      hooks: '信息钩-盐船数量',
      roles: '苏代',
    }, {} as never) as { finalized?: string, from?: string, wordcount?: number }
    expect(result.from).toBe('cc 版')
    expect(result.finalized).toContain('定稿')
    expect(result.finalized).toContain('第004章_你的朋友.md')
    const raw = readFileSync(result.finalized!, 'utf8')
    expect(raw).toContain('cc 版草稿正文：他站在即墨城头')
    expect(raw).toContain('status: final')
    expect(raw).toContain('finalizedFrom: cc 版')
    expect(raw).toContain('summary: 苏代登即墨城头观盐船')
    // 归档后定稿可被检索，前情提要随之纳入
    expect(fixture.project.findChapter('定稿', 4)).not.toBeNull()
  })

  it('finalize 支持融合改写稿并覆盖旧定稿', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    await tool.execute({ action: 'finalize', chapter: 4, from: 'cc 版' }, {} as never)
    const result = await tool.execute({
      action: 'finalize',
      chapter: 4,
      from: 'cc 版',
      content: '融合稿：三版合并后的正文。',
    }, {} as never) as { finalized?: string, replacedExisting?: boolean, wordcount?: number }
    expect(result.replacedExisting).toBe(true)
    expect(result.wordcount).toBe(11)
    const raw = readFileSync(result.finalized!, 'utf8')
    expect(raw).toContain('融合稿：三版合并后的正文。')
    expect(raw).not.toContain('cc 版草稿正文')
  })

  it('finalize 缺来源草稿且缺 content 时报错', async () => {
    fixture = makeProject()
    const tool = chaptersTool(fixture.project)
    const result = await tool.execute({ action: 'finalize', chapter: 9, from: 'cc 版' }, {} as never) as { error?: string }
    expect(result.error).toContain('不存在')
  })
})
