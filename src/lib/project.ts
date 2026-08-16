/**
 * 项目映射：把配置解析成可操作的文件视图。
 *
 * 负责：路径解析、卷纲解析缓存、变体章节扫描（兼容三种历史命名）、
 * 亮点桥段库的卷内场景提取、方法论章节提取、语料检索。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
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
  private outlineCache: Outline | null = null
  private chaptersCache = new Map<string, ChapterFile[]>()

  constructor(config: ProjectConfig) {
    this.config = config
  }

  get primaryVariant(): string {
    return this.config.primaryVariant
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

  get outline(): Outline {
    if (!this.outlineCache) {
      this.outlineCache = parseOutline(this.readRequired(this.config.files.outline))
    }
    return this.outlineCache
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

  /** 某变体下全部章节（递归扫描，兼容历史命名），按章号排序。 */
  chapters(variant: string): ChapterFile[] {
    const cached = this.chaptersCache.get(variant)
    if (cached) return cached
    const dir = join(this.config.root, this.config.chaptersDir, variant)
    const files: string[] = []
    const walk = (d: string, depth: number): void => {
      if (!existsSync(d) || depth > 3) return
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name)
        if (entry.isDirectory()) walk(full, depth + 1)
        else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full)
      }
    }
    walk(dir, 0)
    const chapters = files
      .map(path => {
        const info = parseChapterFileName(path.split('/').pop()!)
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
    this.chaptersCache.set(variant, chapters)
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
