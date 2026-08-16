/** novel_bible_query：设定语料检索（圣经/总成稿/卷纲/桥段库）。 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { Project } from '../lib/project.ts'

const EXCERPT_LIMIT = 600

export function bibleQueryTool(project: Project) {
  return defineTool({
    name: 'novel_bible_query',
    description:
      '在小说项目的设定语料（设定圣经/总成稿/千章卷纲/亮点桥段库）中按关键词检索，返回命中章节的标题路径与摘录。写正文前查设定、对答案、核对人物/制度/时间线时使用。',
    parameters: {
      query: { type: 'string', required: true, description: '检索关键词（人名/地名/制度/事件）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const hits = project.searchCorpus(args.query)
      return {
        query: args.query,
        count: hits.length,
        hits: hits.map(hit => ({
          source: hit.source,
          heading: hit.section.heading,
          path: hit.section.path.join(' > '),
          line: hit.section.line,
          excerpt: hit.section.content.slice(0, EXCERPT_LIMIT),
        })),
        hint: hits.length === 0
          ? '无命中。可换同义词（如字/别号/官职名）重试；设定圣经是 v1 期文件，部分概念以总成稿为准。'
          : '',
      }
    },
  })
}
