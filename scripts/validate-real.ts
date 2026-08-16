/**
 * 真实数据端到端验证：直接调用 6 个工具的 execute 逻辑（不经模型）。
 * 全部只读操作，不向真实项目写入任何文件。
 * 运行：node --experimental-strip-types --no-warnings scripts/validate-real.ts
 */
import { chapterBriefTool } from '../src/tools/chapter-brief.ts'
import { chaptersTool } from '../src/tools/chapters.ts'
import { checkTool } from '../src/tools/check.ts'
import { compareVersionsTool } from '../src/tools/compare.ts'
import { coachTool } from '../src/tools/coach.ts'
import { bibleQueryTool } from '../src/tools/bible-query.ts'
import type { ProjectConfig } from '../src/config.ts'
import { Project } from '../src/lib/project.ts'

const config: ProjectConfig = {
  root: '/path/to/齐国大航海/v2',
  files: {
    bible: '../v1/00_设定圣经.md',
    master: '存道-四部总成稿.md',
    outline: '存道-千章卷纲.md',
    methodology: '存道-网文写作方法论.md',
    bridges: '存道-亮点桥段设计.md',
  },
  chaptersDir: '正文',
  finalVariant: '定稿',
  variants: ['cc 版', 'ds 版', 'gemini 版'],
  nearChapters: 5,
  coachMode: false,
  anachronismLexicon: [],
  anachronismWhitelist: [],
}

const project = new Project(config)
const brief = (o: unknown): string => JSON.stringify(o).slice(0, 400)

async function run(name: string, fn: () => Promise<unknown>): Promise<void> {
  process.stdout.write(`\n===== ${name} =====\n`)
  try {
    const result = await fn()
    process.stdout.write(`${brief(result)}\n`)
  } catch (error) {
    process.stdout.write(`❌ ${String(error)}\n`)
    process.exitCode = 1
  }
}

const bible = bibleQueryTool(project)
const chapterBrief = chapterBriefTool(project)
const chapters = chaptersTool(project)
const check = checkTool(project)
const compare = compareVersionsTool(project)
const coach = coachTool(project)

await run('bible_query 苏秦', () => bible.execute({ query: '苏秦' }, {} as never))
await run('bible_query 逼空', () => bible.execute({ query: '逼空' }, {} as never))
await run('chapter_brief 第4章（下一章，含定稿缺口警告）', () => chapterBrief.execute({ chapter: 4 }, {} as never))
await run('chapter_brief 第500章（跨部远章）', () => chapterBrief.execute({ chapter: 500 }, {} as never))
await run('chapters list 定稿（唯一正典）', () => chapters.execute({ action: 'list' }, {} as never))
await run('chapters list cc 版（草稿竞技场）', () => chapters.execute({ action: 'list', variant: 'cc 版' }, {} as never))
await run('chapters progress 定稿', () => chapters.execute({ action: 'progress' }, {} as never))
await run('check 1,2,3 cc 版草稿（显式 variant）', () => check.execute({ chapters: '1,2,3', variant: 'cc 版' }, {} as never))
await run('compare 第1章 三版草稿+定稿状态', () => compare.execute({ chapter: 1 }, {} as never))
await run('coach（coachMode 关闭应报错）', () => coach.execute({ mode: 'critique', chapter: 1 }, {} as never))
