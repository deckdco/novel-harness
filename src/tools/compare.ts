/** novel_compare_versions：多模型同章竞写对比。 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import { countChineseChars, type ChapterFile, type Project } from '../lib/project.ts'

function tailLines(body: string, count: number): string {
  const lines = body.trimEnd().split('\n').filter(l => l.trim() !== '')
  return lines.slice(-count).join(' ').slice(0, 220)
}

function headLines(body: string, count: number): string {
  const lines = body.trimStart().split('\n').filter(l => l.trim() !== '')
  return lines.slice(0, count).join(' ').slice(0, 220)
}

function variantStats(file: ChapterFile | null, variant: string): Record<string, JsonValue> {
  if (!file) return { variant, exists: false }
  return {
    variant,
    exists: true,
    title: file.title,
    status: typeof file.data.status === 'string' ? file.data.status : '',
    wordcount: typeof file.data.wordcount === 'number' ? file.data.wordcount : countChineseChars(file.body),
    actualChars: countChineseChars(file.body),
    hooks: Array.isArray(file.data.hooks) ? file.data.hooks : [],
    opening: headLines(file.body, 2),
    ending: tailLines(file.body, 2),
    path: file.path,
  }
}

export function compareVersionsTool(project: Project) {
  return defineTool({
    name: 'novel_compare_versions',
    description:
      '同章多模型竞写对比：各变体的字数/状态/钩子/开头/结尾并排呈现。用于 cc/ds/gemini 等版本选优，或检查单一版本是否偏离卷纲。',
    parameters: {
      chapter: { type: 'number', required: true, description: '章号' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const beat = (() => {
        const volume = project.volumeForChapter(args.chapter)
        return volume?.chapterBeats.find(b => b.chapter === args.chapter) ?? null
      })()
      return {
        chapter: args.chapter,
        outlineBeat: beat,
        variants: project.config.variants.map(variant =>
          variantStats(project.findChapter(variant, args.chapter), variant),
        ),
        selectionCriteria: [
          '开头 300 字是否更快进入场景',
          '章尾钩子强度与类型（对照卷纲 beat 要求）',
          '现代概念是否内化转译（无穿越词/无术语直出）',
          '对话是否有信息差张力（§五）',
          '与卷纲节拍的完成度',
        ],
      }
    },
  })
}
