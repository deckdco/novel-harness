/**
 * 前情提要塔：千章长篇的上下文管理。
 *
 * 近章（默认前 5 章）：frontmatter summary 详摘 + 钩子记录。
 * 远章：按卷粗摘——每卷已写章数 + 各章一句话串联，超出预算时截断。
 */
import type { ChapterFile, Project } from './project.ts'

export type NearRecap = {
  chapter: number
  title: string
  summary: string
  hooks: string[]
  status: string
}

export type FarRecap = {
  volumeLabel: string
  volumeTitle: string
  written: number
  chapterRange: string
  digest: string
}

export type Recap = {
  uptoChapter: number
  near: NearRecap[]
  far: FarRecap[]
}

const BODY_DIGEST_LIMIT = 120

function fallbackSummary(chapter: ChapterFile): string {
  const text = chapter.body.replace(/^#+\s.*$/m, '').replace(/[*_>#]/g, '').replace(/\s+/g, ' ').trim()
  return text.slice(0, BODY_DIGEST_LIMIT) + (text.length > BODY_DIGEST_LIMIT ? '…' : '')
}

export function buildRecap(project: Project, uptoChapter: number, nearCount: number): Recap {
  const written = project
    .chapters(project.primaryVariant)
    .filter(c => c.chapter < uptoChapter && c.chapter > 0)
  const nearChapters = written.slice(-nearCount)
  const nearChapterNumbers = new Set(nearChapters.map(c => c.chapter))
  const farChapters = written.filter(c => !nearChapterNumbers.has(c.chapter))

  const near: NearRecap[] = nearChapters.map(c => ({
    chapter: c.chapter,
    title: c.title,
    summary: typeof c.data.summary === 'string' && c.data.summary !== '' ? c.data.summary : `（缺 summary，正文开头截取）${fallbackSummary(c)}`,
    hooks: Array.isArray(c.data.hooks) ? c.data.hooks : [],
    status: typeof c.data.status === 'string' ? c.data.status : '',
  }))

  const buckets = new Map<number, ChapterFile[]>()
  for (const c of farChapters) {
    const volume = project.volumeForChapter(c.chapter)
    const key = volume ? volume.volumeIndex : Math.floor((c.chapter - 1) / 50)
    const list = buckets.get(key) ?? []
    list.push(c)
    buckets.set(key, list)
  }

  const far: FarRecap[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, chapters]) => {
      const volume = project.volumeForChapter(chapters[0].chapter)
      const label = volume ? volume.volumeLabel : `第${key + 1}段`
      const title = volume ? volume.title : ''
      const digest = chapters
        .map(c => `Ch${c.chapter}${typeof c.data.summary === 'string' && c.data.summary !== '' ? c.data.summary : fallbackSummary(c)}`)
        .join('；')
      return {
        volumeLabel: label,
        volumeTitle: title,
        written: chapters.length,
        chapterRange: `Ch${chapters[0].chapter}–${chapters[chapters.length - 1].chapter}`,
        digest: digest.length > 600 ? `${digest.slice(0, 600)}…（截断）` : digest,
      }
    })

  return { uptoChapter, near, far }
}
