/**
 * 项目映射：把配置解析成可操作的文件视图。
 *
 * 核心约定：finalVariant（定稿文件夹）是唯一正典——前情提要、检查器、
 * 进度统计默认只读定稿；variants（cc/ds/gemini）只是当章竞写草稿。
 *
 * 卷纲是活文档（随定稿人工修订），用 mtime 失效缓存；
 * 草稿章节由外部工具随时写入，章节缓存用「路径+mtime 签名」校验，
 * 签名变化自动重载，避免读到过期内容。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import type { ProjectConfig } from '../config.ts'
import type { FrontmatterValue } from './frontmatter.ts'
import { splitFrontmatter } from './frontmatter.ts'
import { parseChapterFileName } from './naming.ts'
import { findVolumeForChapter, parseOutline } from './outline-parser.ts'
import type { Outline, VolumeOutline } from './outline-parser.ts'
import { findSection, searchSections, splitSections } from './sections.ts'
import type { Section } from './sections.ts'

export interface ChapterFile {
  variant: string
  path: string
  chapter: number
  title: string
  data: Record<string, FrontmatterValue>
  body: string
}

export interface CorpusHit {
  source: string
  section: Section
}

const VOLUME_HEADING_RE = /^卷([一二三四五六七八九十]{1,3})·/

/** 中文字数统计：CJK 字符数（不含标点与空白）。 */
export function countChineseChars(text: string): number {
  const matches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)
  return matches ? matches.length : 0
}

export class Project {
  readonly config: ProjectConfig
  private outlineCache: { outline: Outline, mtimeMs: number } | null = null
  private chaptersCache = new Map<string, { signature: string, chapters: ChapterFile[] }>()

  constructor(config: ProjectConfig) {
    this.config = config
  }

  /** 定稿文件夹名：唯一正典。 */
  get finalVariant(): string {
    return this.config.finalVariant
  }

  resolve(p: string): string {
    return isAbsolute(p) ? p : join(this.config.root, p)
  }

  readOptional(p: string): string | null {
    const abs = this.resolve(p)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null
  }

  readRequired(p: string): string {
    const abs = this.resolve(p)
    if (!existsSync(abs)) throw new Error(`文件不存在: ${abs}`)
    return readFileSync(abs, 'utf8')
  }

  /** 卷纲（活文档）：文件 mtime 变化即重新解析。 */
  get outline(): Outline {
    const abs = this.resolve(this.config.files.outline)
    const mtimeMs = statSync(abs).mtimeMs
    if (!this.outlineCache || this.outlineCache.mtimeMs !== mtimeMs) {
      this.outlineCache = { outline: parseOutline(readFileSync(abs, 'utf8')), mtimeMs }
    }
    return this.outlineCache.outline
  }

  volumeForChapter(chapter: number): VolumeOutline | null {
    return findVolumeForChapter(this.outline, chapter)
  }

  /** 桥段库中某卷的场景清单（h3 级条目）。 */
  bridgesScenes(volume: VolumeOutline): { heading: string, content: string }[] {
    const raw = this.readOptional(this.config.files.bridges)
    if (!raw) return []
    const label = volume.volumeLabel
    const inVolume: { heading: string, content: string }[] = []
    let inside = false
    for (const section of splitSections(raw)) {
      if (section.level === 2) inside = section.heading.includes(label)
      if (inside && section.level >= 3) {
        inVolume.push({ heading: section.heading, content: section.content })
      }
    }
    return inVolume
  }

  /** 方法论指定章节（headingKeyword 如 '十、'、'2.2'、'3.1'）。 */
  methodologySection(headingKeyword: string): Section | null {
    const raw = this.readOptional(this.config.files.methodology)
    if (!raw) return null
    return findSection(splitSections(raw), headingKeyword)
  }

  /** 某变体下全部章节（递归扫描，兼容历史命名），按章号排序。
   *  缓存以「文件路径+mtime」签名校验——草稿由外部工具写入也能及时感知。 */
  chapters(variant: string): ChapterFile[] {
    const dir = join(this.config.root, this.config.chaptersDir, variant)
    const entries: Array<{ path: string, mtimeMs: number }> = []
    const walk = (d: string, depth: number): void => {
      if (!existsSync(d) || depth > 3) return
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name)
        if (entry.isDirectory()) walk(full, depth + 1)
        else if (entry.isFile() && entry.name.endsWith('.md')) {
          entries.push({ path: full, mtimeMs: statSync(full).mtimeMs })
        }
      }
    }
    walk(dir, 0)
    const signature = entries.map(e => `${e.path}:${e.mtimeMs}`).join('|')
    const cached = this.chaptersCache.get(variant)
    if (cached && cached.signature === signature) return cached.chapters

    const chapters = entries
      .map(({ path }) => {
        const info = parseChapterFileName(basename(path))
        if (!info) return null
        const raw = readFileSync(path, 'utf8')
        const parsed = splitFrontmatter(raw)
        const chapter: ChapterFile = {
          variant,
          path,
          chapter: info.chapter,
          title: info.title,
          data: parsed?.data ?? {},
          body: parsed?.body ?? raw,
        }
        return chapter
      })
      .filter((c): c is ChapterFile => c !== null)
      .sort((a, b) => a.chapter - b.chapter)
    this.chaptersCache.set(variant, { signature, chapters })
    return chapters
  }

  findChapter(variant: string, chapter: number): ChapterFile | null {
    return this.chapters(variant).find(c => c.chapter === chapter) ?? null
  }

  /** 在设定语料（圣经/总成稿/卷纲）中检索关键词。 */
  searchCorpus(keyword: string, limit = 6): CorpusHit[] {
    const sources: Array<[string, string]> = [
      ['设定圣经', this.config.files.bible],
      ['总成稿', this.config.files.master],
      ['卷纲', this.config.files.outline],
      ['亮点桥段', this.config.files.bridges],
    ]
    const hits: CorpusHit[] = []
    for (const [label, file] of sources) {
      const raw = this.readOptional(file)
      if (!raw) continue
      for (const section of searchSections(splitSections(raw), keyword, limit)) {
        hits.push({ source: label, section })
        if (hits.length >= limit) return hits
      }
    }
    return hits
  }

  /** 让章节扫描缓存失效（save 工具写入后调用）。 */
  invalidateChapters(variant?: string): void {
    if (variant) this.chaptersCache.delete(variant)
    else this.chaptersCache.clear()
  }
}

export { VOLUME_HEADING_RE }
