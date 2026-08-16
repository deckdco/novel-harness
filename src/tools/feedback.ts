/**
 * novel_feedback：作者偏好反馈循环。
 *
 * 你对草稿的修改是最高质量的偏好证据：删掉的段=最强负向信号，
 * 亲手改写/补写的段=最强正向信号，未选用稿的共性=选稿倾向。
 *
 * digest  = 生成「作者偏好反馈包」：对每个已定稿章（有 finalizedFrom
 *           溯源的），现场计算 定稿 vs 来源草稿 的段落级差异，连同
 *           偏好档案与归纳指引，输出可直接整块粘贴给 cc/ds/gemini
 *           任一初稿生成方的文本。
 * distill = 把归纳出的偏好规则写入作者偏好档案（追加/覆盖），
 *           此后每章任务卡（novel_chapter_brief）自动携带。
 *
 * 证据确定性提取，归纳交给模型——与检查器同一哲学。
 */
import { existsSync, writeFileSync } from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import { clip, diffParagraphs } from '../lib/diff.ts'
import { countChineseChars, type Project } from '../lib/project.ts'

const MODIFIED_SAMPLES = 6
const ONE_SIDE_SAMPLES = 3
const SAMPLE_CLIP = 180
const BIBLE_CLIP = 3000

type FeedbackEntry = Record<string, JsonValue>

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildDigestEntry(project: Project, chapter: number, from: string): FeedbackEntry {
  const final = project.findChapter(project.finalVariant, chapter)!
  const draft = project.findChapter(from, chapter)
  const base: FeedbackEntry = { chapter, from }
  if (!draft) {
    base.note = `来源草稿（${from} 第${chapter}章）已不存在，无法对比——若草稿被覆盖，本条证据失效`
    return base
  }
  const diff = diffParagraphs(draft.body, final.body)
  const draftCount = countChineseChars(draft.body)
  const finalCount = countChineseChars(final.body)
  const unchosen = project.config.variants
    .filter(v => v !== from && v !== project.config.finalVariant)
    .map(v => {
      const f = project.findChapter(v, chapter)
      return f ? { variant: v, wordcount: countChineseChars(f.body), title: f.title } : null
    })
    .filter((x): x is { variant: string, wordcount: number, title: string } => x !== null)
  return {
    ...base,
    titles: { draft: draft.title, final: final.title },
    wordcount: { draft: draftCount, final: finalCount, delta: finalCount - draftCount },
    changes: { modified: diff.modified.length, added: diff.added.length, removed: diff.removed.length },
    modifiedSamples: diff.modified.slice(0, MODIFIED_SAMPLES).map(p => ({ draft: clip(p.draft, SAMPLE_CLIP), final: clip(p.final, SAMPLE_CLIP) })),
    addedSamples: diff.added.slice(0, ONE_SIDE_SAMPLES).map(p => clip(p, SAMPLE_CLIP)),
    removedSamples: diff.removed.slice(0, ONE_SIDE_SAMPLES).map(p => clip(p, SAMPLE_CLIP)),
    unchosenDrafts: unchosen,
  }
}

function buildPasteBlock(value: { preferenceBible: string | null, entries: FeedbackEntry[], guidance: string[] }): string {
  const lines: string[] = [
    '# 作者偏好反馈包（novel-harness 生成）',
    '',
    '> 交给任一初稿生成方（cc / ds / gemini）。下面是作者近期定稿对草稿的修改证据',
    '> 与已归纳偏好：内化它们，下一章初稿直接遵守；不要复述本包内容，只体现偏好。',
  ]
  if (value.preferenceBible) {
    lines.push('', '## 已归纳的作者偏好档案', '', value.preferenceBible)
  }
  for (const e of value.entries) {
    const entry = e as Record<string, unknown>
    lines.push('', `## 第${entry.chapter}章 · 选自 ${entry.from} 稿`)
    if (typeof entry.note === 'string') {
      lines.push(`- ${entry.note}`)
      continue
    }
    const wc = entry.wordcount as { draft: number, final: number, delta: number }
    const ch = entry.changes as { modified: number, added: number, removed: number }
    lines.push(`- 字数：草稿 ${wc.draft} → 定稿 ${wc.final}（${wc.delta >= 0 ? '+' : ''}${wc.delta}）`)
    lines.push(`- 段落变更：修改 ${ch.modified} 段 / 新增 ${ch.added} 段 / 删除 ${ch.removed} 段`)
    for (const s of (entry.modifiedSamples as Array<{ draft: string, final: string }>) ?? []) {
      lines.push(`- 草稿：${s.draft}`, `+ 定稿：${s.final}`)
    }
    for (const s of (entry.addedSamples as string[]) ?? []) lines.push(`+ 作者新增段：${s}`)
    for (const s of (entry.removedSamples as string[]) ?? []) lines.push(`- 作者删除段：${s}`)
  }
  lines.push('', '## 请执行')
  for (const g of value.guidance) lines.push(`- ${g}`)
  return lines.join('\n')
}

export function feedbackTool(project: Project) {
  return defineTool({
    name: 'novel_feedback',
    description:
      '作者偏好反馈循环：digest=对比近几章「定稿 vs 来源草稿」的段落级差异，生成可整块粘贴给 cc/ds/gemini 的偏好反馈包（修改/新增/删除段证据+偏好档案+归纳指引）；distill=把归纳出的偏好规则写入作者偏好档案，此后每章任务卡自动携带。定稿后运行，让三方初稿越写越合口味。',
    parameters: {
      action: { type: 'string', required: true, description: 'digest | distill' },
      recent: { type: 'number', description: 'digest 取最近几个定稿章（默认 5）' },
      chapters: { type: 'string', description: 'digest 显式指定章号列表（逗号分隔），优先于 recent' },
      content: { type: 'string', description: 'distill 的偏好规则文本（markdown，可执行规则 3–8 条）' },
      mode: { type: 'string', description: 'distill 写入方式：append（默认，带日期追加）| replace（整档重写）' },
    },
    output: {
      schema: { type: 'json' },
      render: (args, value) => {
        if (args.action === 'digest') {
          const v = value as { preferenceBible: string | null, entries: FeedbackEntry[], guidance: string[] }
          return [{ type: 'text', text: buildPasteBlock(v) }]
        }
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
    },
    async execute(args): Promise<JsonValue> {
      if (args.action === 'digest') {
        const finalized = project
          .chapters(project.finalVariant)
          .filter(c => typeof c.data.finalizedFrom === 'string' && c.data.finalizedFrom !== '')
          .sort((x, y) => x.chapter - y.chapter)
        let picked = finalized
        if (args.chapters) {
          const wanted = new Set(args.chapters.split(/[,,]/).map(s => Number.parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0))
          picked = finalized.filter(c => wanted.has(c.chapter))
        } else {
          const recent = args.recent ?? 5
          picked = finalized.slice(-recent)
        }
        const bibleRaw = project.readOptional(project.config.files.preference)
        return {
          basis: `定稿文件夹「${project.finalVariant}」中有 finalizedFrom 溯源的证据章 ${finalized.length} 个，本次取 ${picked.length} 个`,
          preferenceBible: bibleRaw ? clip(bibleRaw, BIBLE_CLIP) : null,
          preferenceBibleNote: bibleRaw ? null : `尚无作者偏好档案（${project.config.files.preference}）——先看几轮 digest 证据，再用 distill 建档`,
          entries: picked.map(c => buildDigestEntry(project, c.chapter, c.data.finalizedFrom as string)),
          guidance: [
            '逐章对比「草稿段 → 定稿段」的修改证据，归纳作者在节奏/对话密度/描写取舍/钩子强度/句式长短上的稳定偏好，压缩为 3–8 条可执行规则',
            '作者删除段是 strongest 负向信号：删掉的写法（拖沓描写/无效对话/直白抒情等）下一章初稿直接避免',
            '作者新增段是 strongest 正向信号：亲手补的内容（细节锚点/信息差/动作反应等）主动复现其手法',
            '未选用稿（unchosenDrafts）的共性缺陷也是选稿倾向信号',
            '规则与作者偏好档案冲突时，以偏好档案为准',
          ],
        }
      }

      if (args.action === 'distill') {
        if (!args.content || args.content.trim() === '') return { error: 'distill 需要 content（归纳出的偏好规则文本）' }
        const path = project.resolve(project.config.files.preference)
        const mode = args.mode === 'replace' ? 'replace' : 'append'
        const existing = existsSync(path) ? project.readOptional(project.config.files.preference) : null
        const lastFinalized = project.chapters(project.finalVariant).at(-1)?.chapter ?? null
        const header = `## ${today()}${lastFinalized ? ` · 定稿至第${lastFinalized}章` : ''}`
        let next: string
        if (mode === 'replace') {
          next = args.content.trim() + '\n'
        } else if (!existing) {
          next = `# 作者偏好档案\n\n${header}\n\n${args.content.trim()}\n`
        } else {
          next = `${existing.trimEnd()}\n\n${header}\n\n${args.content.trim()}\n`
        }
        writeFileSync(path, next)
        return {
          saved: path,
          mode,
          note: '偏好档案已更新：此后每章任务卡（novel_chapter_brief）自动携带；外部模型用 digest 的反馈包同步。',
        }
      }

      return { error: `未知 action: ${args.action}` }
    },
  })
}
