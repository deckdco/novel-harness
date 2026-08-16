/** novel_chapters：章节规范化管理（create/save/list/progress）。 */
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

export function chaptersTool(project: Project) {
  return defineTool({
    name: 'novel_chapters',
    description:
      '章节规范化管理。create=按规范命名与 frontmatter 建章；save=写入正文并自动维护 wordcount/status 等元数据（正文由你先写好，本工具负责落盘规范化）；list=章节清单；progress=按卷进度统计。',
    parameters: {
      action: { type: 'string', required: true, description: 'create | save | list | progress' },
      chapter: { type: 'number', description: '章号（create/save 必填）' },
      title: { type: 'string', description: '章名（create 必填；save 可用于改名）' },
      content: { type: 'string', description: '正文全文，不含 frontmatter（save 必填）' },
      variant: { type: 'string', description: '变体目录名，默认主变体' },
      status: { type: 'string', description: 'save 时更新的状态，如 draft-v2 / final' },
      summary: { type: 'string', description: 'save 时更新的一句话剧情摘要（强烈建议提供，前情提要塔依赖它）' },
      hooks: { type: 'string', description: 'save 时更新的钩子标注，分号分隔，如"信息钩-即墨假牌；情感钩-苏秦"' },
      roles: { type: 'string', description: 'save 时更新的出场人物，分号分隔' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const variant = args.variant ?? project.config.primaryVariant

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
        if (args.hooks) merged.hooks = args.hooks.split(/[;；]/).map(s => s.trim()).filter(s => s !== '')
        if (args.roles) merged.roles = args.roles.split(/[;；]/).map(s => s.trim()).filter(s => s !== '')

        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, `---\n${serializeFrontmatter(merged)}---\n\n${args.content.trim()}\n`)
        project.invalidateChapters(variant)
        return {
          saved: path,
          wordcount: merged.wordcount,
          wordcountNote: '中文字符数（不含标点）',
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
