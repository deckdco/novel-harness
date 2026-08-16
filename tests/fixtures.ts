/** 临时微型小说项目，供 checks/recap/finalize 集成测试使用。
 *  结构对齐真实工作流：定稿文件夹=唯一正典（ch1–3），
 *  cc 版=竞写草稿竞技场（ch4 草稿，等 finalize 归档）。 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProjectConfig } from '../src/config.ts'
import { Project } from '../src/lib/project.ts'

const OUTLINE = `# 《测试》卷纲

# 第一部《测试部》(Ch1–60)— 测试

## 卷一·测试卷(Ch1–10)
- **一句话**: 测试卷。
- **3节**: Ch1「开局」(穿越);Ch2「破局」(打脸)。
- **机制**: 测试机制。
- **卷尾钩**: 测试钩。
- **★互动设计**:
  - **金句**: 测试金句。

## 卷二·第二卷(Ch11–20)
- **一句话**: 卷二。
`

export interface Fixture {
  project: Project
  dir: string
  cleanup(): void
}

function writeChapter(dir: string, chapter: number, title: string, body: string, extra: Record<string, unknown> = {}): void {
  const frontmatter = [
    '---',
    `type: 正文`,
    `status: draft-v1`,
    `chapter: ${chapter}`,
    `volume: 1`,
    `summary: 第${chapter}章摘要`,
    '---',
    '',
    body,
    '',
  ].join('\n')
  void extra
  writeFileSync(join(dir, `第${String(chapter).padStart(3, '0')}章_${title}.md`), frontmatter)
}

export function makeProject(chapterOverrides: Record<number, { body?: string, frontmatter?: string }> = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'novel-harness-test-'))
  const root = join(dir, 'novel')
  const finalDir = join(root, '正文', '定稿', '卷一·测试卷')
  const draftDir = join(root, '正文', 'cc 版', '卷一·测试卷')
  mkdirSync(finalDir, { recursive: true })
  mkdirSync(draftDir, { recursive: true })

  writeFileSync(join(root, 'outline.md'), OUTLINE)
  writeFileSync(join(root, 'methodology.md'), '# 方法论\n\n## 十、写作纪律\n内化不显示。\n')

  const defaults: Record<number, [string, string]> = {
    1: ['醒在火上', '他醒来。桌上有一张纸，写着皇上的命令，还有一斗玉米。'],
    2: ['破局', '他破了局。'],
    3: ['倒计时', '倒计时开始。'],
  }
  for (const [chapterStr, [title, body]] of Object.entries(defaults)) {
    const chapter = Number(chapterStr)
    const override = chapterOverrides[chapter]
    const finalBody = override?.body ?? body
    if (override?.frontmatter === 'none') {
      writeFileSync(join(finalDir, `第${String(chapter).padStart(3, '0')}章_${title}.md`), finalBody + '\n')
    } else {
      writeChapter(finalDir, chapter, title, finalBody, override)
    }
  }
  for (const [chapterStr, override] of Object.entries(chapterOverrides)) {
    const chapter = Number(chapterStr)
    if (chapter in defaults) continue
    writeChapter(finalDir, chapter, `第${chapter}章名`, override.body ?? '正文内容。')
  }

  // cc 版竞写草稿：第4章（正文与定稿不同，用于验证前情提要隔离与 finalize）
  writeChapter(draftDir, 4, '你的朋友', 'cc 版草稿正文：他站在即墨城头，望着运盐的船。')

  const config: ProjectConfig = {
    root,
    files: {
      bible: 'bible.md',
      master: 'outline.md',
      outline: 'outline.md',
      methodology: 'methodology.md',
      bridges: 'bridges.md',
    },
    chaptersDir: '正文',
    finalVariant: '定稿',
    variants: ['cc 版', 'ds 版'],
    nearChapters: 5,
    coachMode: false,
    anachronismLexicon: [],
    anachronismWhitelist: [],
  }
  return {
    project: new Project(config),
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
