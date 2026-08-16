/** 钩子覆盖检查：方法论 §三"章尾钩子=追读率生死线"、§6.1 钩子系统。 */
import type { CheckContext, CheckReport } from './types.ts'

const HOOK_STREAK_LIMIT = 3

export function checkHooksCoverage(ctx: CheckContext): CheckReport {
  const report: CheckReport = {
    checker: 'hooks-coverage',
    description: '章尾钩子覆盖：不允许连续3章无钩子（frontmatter hooks 字段为准）',
    findings: [],
    prompts: [],
  }

  const series = ctx.project.chapters(ctx.project.finalVariant)
  const checked = new Set(ctx.chapters.map(c => c.chapter))
  const streak: number[] = []
  for (const c of series) {
    const hasHooks = Array.isArray(c.data.hooks) && c.data.hooks.length > 0
    if (hasHooks) {
      streak.length = 0
      continue
    }
    streak.push(c.chapter)
    if (checked.has(c.chapter)) {
      report.findings.push({
        level: 'warn',
        message: `第${c.chapter}章《${c.title}》frontmatter 无 hooks 标注`,
      })
    }
    if (streak.length >= HOOK_STREAK_LIMIT && streak.some(ch => checked.has(ch))) {
      report.findings.push({
        level: 'error',
        message: `连续 ${streak.length} 章无钩子（Ch${streak[0]}–Ch${streak[streak.length - 1]}），触碰"连续3章无钩"红线`,
      })
    }
  }
  if (streak.length > 0 && streak.length < HOOK_STREAK_LIMIT && streak.some(ch => checked.has(ch))) {
    report.findings.push({
      level: 'info',
      message: `当前无钩序列 Ch${streak[0]}–Ch${streak[streak.length - 1]}（${streak.length} 章，接近红线）`,
    })
  }

  report.prompts.push(
    '方法论§3.1 五类章尾钩子模板：①动作截断 ②反转揭秘（须提前埋线索）③未知危机突袭（容错率最高）④信息遮断 ⑤关键信息凸显。逐章核对章尾最后200字属于哪一类；无法归类的章需要补钩。',
  )
  return report
}
