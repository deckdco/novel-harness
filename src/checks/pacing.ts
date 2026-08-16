/** 节奏检查：方法论 §4.2 节奏五问 + 单章字数区间的确定性统计。 */
import { countChineseChars } from '../lib/project.ts'
import type { CheckContext, CheckReport } from './types.ts'

const MIN_CHAPTER_CHARS = 1800
const MAX_CHAPTER_CHARS = 6000

export function checkPacing(ctx: CheckContext): CheckReport {
  const report: CheckReport = {
    checker: 'pacing',
    description: '节奏检查：字数区间统计 + 节奏五问（方法论§4.2）',
    findings: [],
    prompts: [],
  }

  const stats: string[] = []
  for (const chapter of ctx.chapters) {
    const chars = countChineseChars(chapter.body)
    stats.push(`第${chapter.chapter}章 ${chars} 字`)
    if (chars < MIN_CHAPTER_CHARS) {
      report.findings.push({ level: 'warn', message: `第${chapter.chapter}章仅 ${chars} 字（低于 ${MIN_CHAPTER_CHARS} 下限，起点常态 2000–5000）` })
    } else if (chars > MAX_CHAPTER_CHARS) {
      report.findings.push({ level: 'warn', message: `第${chapter.chapter}章 ${chars} 字（超过 ${MAX_CHAPTER_CHARS} 上限，单章过载影响追更节奏）` })
    }
  }
  if (stats.length > 0) report.findings.push({ level: 'info', message: `字数序列：${stats.join('；')}` })

  report.prompts.push(
    '方法论§4.2 节奏五问（每写完10章自查）：1) 最近5章有无连续2章以上无爽点/钩子？2) 是否出现"高潮疲劳"（连续高潮稀释爽感）？3) 快慢是否交替（不能5章全是朝堂争论或全是战争）？4) 连续高压后有没有1–2章日常/情感的喘息空间？5) 本部是否有中期大高潮安排？',
    '方法论§4.3 中段塌陷防护（30–100万字区间）适用时优先检查。',
  )
  return report
}
