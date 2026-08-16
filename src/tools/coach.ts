/**
 * novel_coach：教练模式（config.coachMode 开启后可用）。
 *
 * 哲学来自项目 7 月调研（§8：教练不代笔）：不提供正文生成，
 * 只给"临摹比对/苏格拉底提问"的评课脚本，由模型按脚本执行。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { Project } from '../lib/project.ts'

export function coachTool(project: Project) {
  return defineTool({
    name: 'novel_coach',
    description:
      '教练模式（需 config.coachMode 开启）。mode=critique：对本章做证据式讲评（每条意见必须引用正文原句）；mode=socratic：把"帮我写/续写/扩写"类请求转换为引导提问，不代笔。',
    parameters: {
      mode: { type: 'string', required: true, description: 'critique | socratic' },
      chapter: { type: 'number', description: '被讲评的章号（critique 必填）' },
      focus: { type: 'string', description: '聚焦维度，如 对话 / 钩子 / 节奏 / 考据' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      if (!project.config.coachMode) {
        return {
          error: 'coachMode 未开启。在 cordis.yml 的插件 config 中设置 coachMode: true 后重启。',
        }
      }

      if (args.mode === 'critique') {
        if (!args.chapter) return { error: 'critique 需要 chapter' }
        const file = project.findChapter(project.primaryVariant, args.chapter)
        if (!file) return { error: `第${args.chapter}章在 ${project.primaryVariant} 下不存在` }
        const volume = project.volumeForChapter(args.chapter)
        return {
          mode: 'critique',
          chapter: args.chapter,
          focus: args.focus ?? '全文',
          rules: [
            '每一条讲评意见必须引用正文原句作为证据（格式："「引文」→ 诊断 → 修改方向"），无引用的意见不发',
            '先说做对了什么（对照卷纲 beat 与方法论清单），再说差距',
            '禁止直接给出改写后的成段正文——只给方向与示例句式（≤30字）',
            '时代错漏引用本章 anachronism 结果，不凭印象',
          ],
          chapterPath: file.path,
          volumeContext: volume ? { label: volume.volumeLabel, title: volume.title, oneline: volume.oneline ?? '' } : null,
          rubric: [
            '方法论§2.2 黄金三章六问（第1–3章）',
            '§3 章尾钩子五类模板归属',
            '§4.2 节奏五问',
            '§5 对话五技巧（信息差/潜台词/动作穿插）',
            '§6 场景代替叙述、动作代替形容词',
            '§10.1 内化不显示：现代概念必须转译为战国可感语言',
          ],
        }
      }

      if (args.mode === 'socratic') {
        return {
          mode: 'socratic',
          rules: [
            '用户要求"帮我写/续写/扩写正文"时，本工具的调用即表示已拒绝直接代笔',
            '转换为提问：此刻谁在场？他知道什么、不知道什么？这一段最想让读者感到什么？',
            '用户给出自己的句子后，按 critique 模式做引用式讲评',
            '例外：大纲、任务卡、设定查询、检查器不受此限——教练约束只针对成段正文',
          ],
        }
      }

      return { error: `未知 mode: ${args.mode}` }
    },
  })
}
