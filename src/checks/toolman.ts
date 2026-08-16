/** 工具人检测：方法论 §8.2 三问。语义判断交模型，工具侧给统计线索。 */
import type { CheckContext, CheckReport } from './types.ts'

/** 配角共情投资（卷纲 v5 系统）：有名字的人物至少跨章出现两次才算"被投资"。 */
export function checkToolman(ctx: CheckContext): CheckReport {
  const report: CheckReport = {
    checker: 'toolman',
    description: '工具人检测（方法论§8.2 三问）+ 配角跨章出现统计',
    findings: [],
    prompts: [],
  }

  const series = ctx.project.chapters(ctx.project.finalVariant)
  const appearance = new Map<string, number[]>()
  for (const c of series) {
    const roles = Array.isArray(c.data.roles) ? c.data.roles : []
    for (const name of roles) {
      const list = appearance.get(name) ?? []
      list.push(c.chapter)
      appearance.set(name, list)
    }
  }
  const single = [...appearance.entries()].filter(([, chs]) => chs.length === 1)
  if (single.length > 0) {
    report.findings.push({
      level: 'info',
      message: `frontmatter roles 标注中仅出现一次的人物（可能是工具人候选）：${single.map(([n, chs]) => `${n}(Ch${chs[0]})`).join('、')}（无 roles 标注时本统计为空，请靠下述三问自查）`,
    })
  }

  report.prompts.push(
    '方法论§8.2 工具人三问（对每个新配角）：1) 删掉这个角色，剧情是否不受影响？（是=工具人）2) 这个角色有没有做出过主角意料之外的决策？（没有=工具人）3) 读者是否比主角更早发现这个角色的天赋/命运？（没有=工具人）',
    '配角人格化三法（§8.1）：给一笔与主线无关的个人欲望；给一次违背主角预期的选择；给一个读者可见但主角未见的成长瞬间。',
  )
  return report
}
