/** novel_chapters：章节规范化管理（create/save/finalize/list/progress）。 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { FrontmatterValue } from '../lib/frontmatter.ts'
import { serializeFrontmatter } from '../lib/frontmatter.ts'
import { buildChapterFileName } from '../lib/naming.ts'
import { countChineseChars, type Project } from '../lib/project.ts'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function chapterPath(project: Project, variant: string, chapter: number, title: string): string {
  const volume = project.volumeForChapter(chapter)
  const volumeDir = volume ? `${volume.volumeLabel}·${volume.title}` : '未分卷'
  return join(project.config.root, project.config.chaptersDir, variant, volumeDir, buildChapterFileName(chapter, title))
}

/** 解析分号分隔的标注字段（hooks/roles）。 */
function parseSemis(raw: string): string[] {
  return raw.split(/[;；]/).map(s => s.trim()).filter(s => s !== '')
}

export function chaptersTool(project: Project) {
  return defineTool({
    name: 'novel_chapters',
    description:
      '章节规范化管理。create=按规范命名与 frontmatter 建章；save=写入正文并自动维护 wordcount/status 等元数据；finalize=竞写选稿后把某变体草稿归档进定稿文件夹（唯一正典，可传 content 覆盖为融合改写稿）；list=章节清单；progress=按卷进度统计。默认操作定稿文件夹，操作草稿时显式传 variant。',
    parameters: {
      action: { type: 'string', required: true, description: 'create | save | finalize | list | progress' },
      chapter: { type: 'number', description: '章号（create/save/finalize 必填）' },
      title: { type: 'string', description: '章名（create 必填；save/finalize 可用于改名）' },
      content: { type: 'string', description: '正文全文，不含 frontmatter（save 必填；finalize 可选=融合改写稿，缺省用来源草稿正文）' },
      variant: { type: 'string', description: '变体目录名，默认定稿文件夹' },
      from: { type: 'string', description: 'finalize 的来源草稿变体名，如 "cc 版"（finalize 必填，除非用 content 直接给定稿正文）' },
      status: { type: 'string', description: 'save/finalize 时更新的状态；finalize 缺省为 final' },
      summary: { type: 'string', description: 'save/finalize 时更新的一句话剧情摘要（强烈建议提供，前情提要塔依赖它）' },
      hooks: { type: 'string', description: 'save/finalize 时更新的钩子标注，分号分隔，如"信息钩-即墨假牌；情感钩-苏秦"' },
      roles: { type: 'string', description: 'save/finalize 时更新的出场人物，分号分隔' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const variant = args.variant ?? project.config.finalVariant

      if (args.action === 'create') {
        if (!args.chapter || !args.title) return { error: 'create 需要 chapter 与 title' }
        const path = chapterPath(project, variant, args.chapter, args.title)
        if (existsSync(path)) return { error: `文件已存在：${path}（如需重写请用 save）` }
        const volume = project.volumeForChapter(args.chapter)
        const frontmatter: Record<string, FrontmatterValue> = {
          type: '正文',
          tags: [volume ? `卷${volume.volumeLabel}` : '未分卷'],
          status: 'draft-v1',
          created: today(),
          summary: '',
          chapter: args.chapter,
          volume: volume ? volume.volumeIndex : 0,
          wordcount: 0,
          hooks: [],
          roles: [],
        }
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, `---\n${serializeFrontmatter(frontmatter)}---\n\n`)
        project.invalidateChapters(variant)
        return { created: path, note: '骨架已建，用 dsh 的编辑工具或 save action 写入正文' }
      }

      if (args.action === 'save') {
        if (!args.chapter || args.content === undefined) return { error: 'save 需要 chapter 与 content' }
        const existing = project.findChapter(variant, args.chapter)
        const title = args.title ?? existing?.title
        if (!title) return { error: `第${args.chapter}章在 ${variant} 下不存在且未提供 title，无法确定文件名` }
        const path = existing?.path ?? chapterPath(project, variant, args.chapter, title)
        const volume = project.volumeForChapter(args.chapter)
        const merged: Record<string, FrontmatterValue> = { ...(existing?.data ?? {}) }
        merged.chapter = args.chapter
        merged.wordcount = countChineseChars(args.content)
        if (volume) merged.volume = volume.volumeIndex
        else if (typeof merged.volume !== 'number') merged.volume = 0
        merged.created = typeof existing?.data.created === 'string' ? existing.data.created : today()
        if (args.status) merged.status = args.status
        if (args.summary) merged.summary = args.summary
        if (args.hooks) merged.hooks = parseSemis(args.hooks)
        if (args.roles) merged.roles = parseSemis(args.roles)

        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, `---\n${serializeFrontmatter(merged)}---\n\n${args.content.trim()}\n`)
        project.invalidateChapters(variant)
        return {
          saved: path,
          wordcount: merged.wordcount,
          wordcountNote: '中文字符数（不含标点）',
        }
      }

      if (args.action === 'finalize') {
        if (!args.chapter) return { error: 'finalize 需要 chapter' }
        const source = args.from ? project.findChapter(args.from, args.chapter) : null
        if (!source && args.content === undefined) {
          return { error: `finalize 需要 from（来源草稿变体）或 content（直接给定稿正文）${args.from ? `，但第${args.chapter}章在 ${args.from} 下不存在` : ''}` }
        }
        const final = project.config.finalVariant
        const existingFinal = project.findChapter(final, args.chapter)
        const body = args.content ?? source!.body
        const title = args.title ?? existingFinal?.title ?? source?.title
        if (!title) return { error: '无法确定章名：来源草稿与定稿均不存在且未提供 title' }
        const path = existingFinal?.path ?? chapterPath(project, final, args.chapter, title)
        const volume = project.volumeForChapter(args.chapter)
        // 元数据基线：优先沿用已有定稿（重新定稿保留 created 等），其次沿用来源草稿的 summary/hooks/roles
        const merged: Record<string, FrontmatterValue> = { ...(source?.data ?? {}), ...(existingFinal?.data ?? {}) }
        merged.chapter = args.chapter
        merged.wordcount = countChineseChars(body)
        if (volume) merged.volume = volume.volumeIndex
        else if (typeof merged.volume !== 'number') merged.volume = 0
        merged.created = typeof merged.created === 'string' && merged.created !== '' ? merged.created : today()
        merged.status = args.status ?? 'final'
        merged.finalized = today()
        if (args.from) merged.finalizedFrom = args.from
        if (args.summary) merged.summary = args.summary
        if (args.hooks) merged.hooks = parseSemis(args.hooks)
        if (args.roles) merged.roles = parseSemis(args.roles)

        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, `---\n${serializeFrontmatter(merged)}---\n\n${body.trim()}\n`)
        project.invalidateChapters(final)
        return {
          finalized: path,
          from: args.from ?? '(content 直接给定)',
          replacedExisting: Boolean(existingFinal),
          wordcount: merged.wordcount,
          note: `已归档进定稿文件夹「${final}」。前情提要/检查器/进度自此刻起只认这份；如卷纲需要随之修订，直接编辑卷纲文件即可（插件按 mtime 自动重载）。`,
        }
      }

      if (args.action === 'list') {
        const chapters = project.chapters(variant)
        return {
          variant,
          count: chapters.length,
          chapters: chapters.map(c => ({
            chapter: c.chapter,
            title: c.title,
            status: c.data.status ?? '',
            wordcount: c.data.wordcount ?? null,
            hooks: Array.isArray(c.data.hooks) ? c.data.hooks.length : 0,
            path: c.path,
          })),
        }
      }

      if (args.action === 'progress') {
        const chapters = project.chapters(variant)
        const byVolume = new Map<number, number>()
        for (const c of chapters) {
          const volume = project.volumeForChapter(c.chapter)
          const key = volume ? volume.volumeIndex : 0
          byVolume.set(key, (byVolume.get(key) ?? 0) + 1)
        }
        const totalChars = chapters.reduce((sum, c) => sum + (typeof c.data.wordcount === 'number' ? c.data.wordcount : countChineseChars(c.body)), 0)
        return {
          variant,
          written: chapters.length,
          plannedTotal: project.outline.volumes.at(-1)?.chEnd ?? null,
          totalChars,
          volumes: project.outline.volumes.map(v => ({
            volume: v.volumeLabel,
            title: v.title,
            range: `Ch${v.chStart}–${v.chEnd}`,
            written: byVolume.get(v.volumeIndex) ?? 0,
            planned: v.chEnd - v.chStart + 1,
          })),
        }
      }

      return { error: `未知 action: ${args.action}` }
    },
  })
}
