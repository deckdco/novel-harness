/** 临时微型小说项目，供 checks/recap 集成测试使用。 */
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
  const chapters = join(root, '正文', 'cc 版', '卷一·测试卷')
  mkdirSync(chapters, { recursive: true })

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
      writeFileSync(join(chapters, `第${String(chapter).padStart(3, '0')}章_${title}.md`), finalBody + '\n')
    } else {
      writeChapter(chapters, chapter, title, finalBody, override)
    }
  }
  for (const [chapterStr, override] of Object.entries(chapterOverrides)) {
    const chapter = Number(chapterStr)
    if (chapter in defaults) continue
    writeChapter(chapters, chapter, `第${chapter}章名`, override.body ?? '正文内容。')
  }

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
    primaryVariant: 'cc 版',
    variants: ['cc 版'],
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
