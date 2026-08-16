/** 黄金三章自检：方法论 §2.2 六问，仅当被查章节覆盖第 1–3 章时产出。 */
import { countChineseChars } from '../lib/project.ts'
import type { CheckContext, CheckReport } from './types.ts'

const GOLDEN_CHAPTERS = [1, 2, 3]
const CH1_MIN_CHARS = 2000

export function checkGolden3(ctx: CheckContext): CheckReport {
  const checkedNumbers = ctx.chapters.map(c => c.chapter)
  const coversGolden = GOLDEN_CHAPTERS.some(n => checkedNumbers.includes(n))
  const report: CheckReport = {
    checker: 'golden3',
    description: '黄金三章自检（方法论§2.2 六问）',
    findings: [],
    prompts: [],
  }
  if (!coversGolden) {
    report.findings.push({ level: 'info', message: '被查章节不含第1–3章，黄金三章自检跳过' })
    return report
  }

  const ch1 = ctx.chapters.find(c => c.chapter === 1)
  if (ch1) {
    const chars = countChineseChars(ch1.body)
    if (chars < CH1_MIN_CHARS) {
      report.findings.push({ level: 'warn', message: `第1章 ${chars} 字（黄金三章期建议 ≥${CH1_MIN_CHARS} 字，保证信息密度）` })
    }
    for (const n of GOLDEN_CHAPTERS) {
      const c = ctx.chapters.find(x => x.chapter === n)
      if (c && (!Array.isArray(c.data.hooks) || c.data.hooks.length === 0)) {
        report.findings.push({ level: 'error', message: `第${n}章无章尾钩子标注——黄金三章每章必须有钩` })
      }
    }
  }

  report.prompts.push(
    '方法论§2.2 黄金三章六问（逐条回答，需引用正文证据）：1) 第一章是否在300字内让读者进入场景？2) 主角出场前是否有足够紧张感/好奇心铺垫？3) 金手指在前三章内是否至少一次"亮技"+至少一次"碰壁"？4) 每章是否都有"想看下一章"的章尾钩子？5) 第一章有无纯设定介绍（无动作/冲突的背景说明）？6) 三章结束时读者是否清楚"这本书爽在哪"（经济权谋/智斗/制度博弈）？',
  )
  return report
}
