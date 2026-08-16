/** novel_check：检查器套件入口。 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import { CHECKERS, CHECKER_NAMES } from '../checks/index.ts'
import type { CheckContext } from '../checks/index.ts'
import type { Project } from '../lib/project.ts'

export function checkTool(project: Project) {
  return defineTool({
    name: 'novel_check',
    description:
      `对已写章节运行检查器套件：${CHECKER_NAMES.join(' / ')}。findings 是确定性结果（词表命中/统计越界）；prompts 是需要你结合正文回答的方法论问题。写完一章或一批章节后运行。`,
    parameters: {
      chapters: { type: 'string', required: true, description: '章号列表，逗号分隔，如 "1,2,3" 或 "4"' },
      checks: { type: 'string', description: `要跑的检查器，逗号分隔；默认全部（${CHECKER_NAMES.join(',')}）` },
      variant: { type: 'string', description: '变体目录名，默认定稿文件夹（唯一正典）；检查某份竞写草稿时显式传入' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const variant = args.variant ?? project.config.finalVariant
      const numbers = args.chapters.split(/[,,]/).map(s => Number.parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0)
      if (numbers.length === 0) return { error: `无法解析章号列表: ${args.chapters}` }

      const missing: number[] = []
      const chapters = numbers.map(n => {
        const file = project.findChapter(variant, n)
        if (!file) missing.push(n)
        return file
      }).filter((c): c is NonNullable<typeof c> => c !== null)
      if (chapters.length === 0) return { error: `第 ${missing.join('、')} 章在 ${variant} 下都不存在` }

      const requested = args.checks
        ? args.checks.split(/[,,]/).map(s => s.trim()).filter(s => s !== '')
        : CHECKER_NAMES
      const unknown = requested.filter(name => !(name in CHECKERS))
      if (unknown.length > 0) return { error: `未知检查器: ${unknown.join(',')}（可用：${CHECKER_NAMES.join(',')}）` }

      const ctx: CheckContext = { project, chapters }
      const reports = requested.map(name => CHECKERS[name](ctx))
      const summary = {
        error: reports.reduce((n, r) => n + r.findings.filter(f => f.level === 'error').length, 0),
        warn: reports.reduce((n, r) => n + r.findings.filter(f => f.level === 'warn').length, 0),
        info: reports.reduce((n, r) => n + r.findings.filter(f => f.level === 'info').length, 0),
      }
      return {
        variant,
        checkedChapters: chapters.map(c => c.chapter),
        ...(missing.length > 0 ? { missingChapters: missing } : {}),
        summary,
        reports,
      }
    },
  })
}
