/**
 * 时代错漏检测：词表扫描 + 上下文摘录。
 *
 * 种子词表针对战国（约公元前3世纪）架空背景；换背景的项目通过
 * config.anachronismLexicon 追加、anachronismWhitelist 豁免。
 * 现代经济学概念单列——本书纪律（§10.1 内化不显示）允许主角内心理解、
 * 禁止出现在叙述与他人对话中，故统一 warn 级交人复核。
 */
import type { CheckContext, CheckReport, CheckLevel } from './types.ts'

interface LexiconEntry {
  word: string
  note: string
  level?: CheckLevel
}

const SEED_LEXICON: LexiconEntry[] = [
  { word: '纸', note: '战国无纸，书写用竹简/帛', level: 'warn' },
  { word: '印刷', note: '雕版印刷唐代才有' },
  { word: '椅子', note: '席地而坐，用席/矮案' },
  { word: '板凳', note: '席地而坐' },
  { word: '玉米', note: '美洲作物，明代传入' },
  { word: '辣椒', note: '美洲作物，明代传入' },
  { word: '土豆', note: '美洲作物，明末传入' },
  { word: '番茄', note: '美洲作物' },
  { word: '花生', note: '美洲作物' },
  { word: '红薯', note: '美洲作物，明末传入' },
  { word: '向日葵', note: '美洲作物' },
  { word: '烟草', note: '明末传入' },
  { word: '银子', note: '战国黄金非流通货币，通行刀币/布币；白银计引用"镒/锱铢"' },
  { word: '银两', note: '银两是明清货币体系' },
  { word: '科举', note: '隋唐创立' },
  { word: '状元', note: '科举产物' },
  { word: '进士', note: '科举产物' },
  { word: '皇上', note: '战国称"大王/王上/君上"' },
  { word: '陛下', note: '秦以后才用于皇帝，战国诸侯称"大王"', level: 'warn' },
  { word: '圣旨', note: '应为"王命/君令/玺书"' },
  { word: '太监', note: '应为"寺人/宦者"' },
  { word: '茶叶', note: '饮茶之风兴于唐' },
  { word: '一杯茶', note: '饮茶之风兴于唐' },
  { word: '火药', note: '唐宋' },
  { word: '鞭炮', note: '火药产物' },
  { word: '指南针', note: '宋代；战国或可用"司南"' },
  { word: '钟表', note: '无，计时用漏刻/日晷' },
  { word: '小时', note: '用时辰/刻', level: 'warn' },
  { word: '分钟', note: '用时辰/刻' },
  { word: '秒钟', note: '无秒的概念' },
  { word: '公里', note: '用"里"' },
  { word: '公斤', note: '用"石/镒/斤"' },
  { word: '棉衣', note: '棉花宋元才普及，战国衣料为丝/麻/葛' },
  { word: '棉花', note: '棉花宋元才普及' },
  { word: '眼镜', note: '明代' },
  { word: '豆腐', note: '传为汉代发明', level: 'info' },
  { word: '馒头', note: '传说三国诸葛亮发明', level: 'info' },
  { word: '轿子', note: '应为"安车/辇"', level: 'warn' },
  { word: '石油', note: '汉代称"石漆"' },
  { word: '玻璃', note: '战国称"琉璃"；"玻璃"一词后起', level: 'warn' },
  { word: '炒菜', note: '炒制烹饪法宋代成熟，战国以蒸/煮/炙/羹', level: 'warn' },
  { word: '股票', note: '现代术语：须内化转译（§10.1），不得出现在叙述与对话', level: 'warn' },
  { word: 'A股', note: '现代术语' },
  { word: '做空', note: '现代金融术语：主角内心可用意象转译，对话/叙述禁止', level: 'warn' },
  { word: '杠杆', note: '现代金融术语', level: 'warn' },
  { word: '期货', note: '现代金融术语', level: 'warn' },
  { word: '期权', note: '现代金融术语', level: 'warn' },
  { word: '基金', note: '现代金融术语', level: 'warn' },
  { word: '银行', note: '现代术语，应为"钱庄"亦晚——用"贷金/子钱家"等战国概念', level: 'warn' },
  { word: '通货膨胀', note: '现代经济学术语' },
]

const DEFAULT_WHITELIST = ['纸上谈兵']

const EXCERPT_RADIUS = 18

export function checkAnachronism(ctx: CheckContext): CheckReport {
  const report: CheckReport = {
    checker: 'anachronism',
    description: '时代错漏词表扫描（战国基准；warn 级需人工复核，成语类误报可加入白名单）',
    findings: [],
    prompts: [],
  }

  const whitelist = [...DEFAULT_WHITELIST, ...ctx.project.config.anachronismWhitelist]
  const extras = ctx.project.config.anachronismLexicon.map((word: string) => ({ word, note: '配置追加词', level: 'warn' as CheckLevel }))
  const lexicon = [...SEED_LEXICON, ...extras]

  const hitInsideWhitelist = (body: string, word: string, index: number): boolean =>
    whitelist.some(phrase => {
      let at = body.indexOf(phrase)
      while (at !== -1) {
        if (index >= at && index < at + phrase.length) return true
        at = body.indexOf(phrase, at + 1)
      }
      return false
    })

  for (const chapter of ctx.chapters) {
    for (const entry of lexicon) {
      let index = chapter.body.indexOf(entry.word)
      while (index !== -1) {
        if (!hitInsideWhitelist(chapter.body, entry.word, index)) {
          const excerpt = chapter.body.slice(Math.max(0, index - EXCERPT_RADIUS), index + entry.word.length + EXCERPT_RADIUS).replace(/\s+/g, ' ')
          report.findings.push({
            level: entry.level ?? 'error',
            message: `第${chapter.chapter}章出现"${entry.word}"：${entry.note}｜上下文：…${excerpt}…`,
          })
        }
        index = chapter.body.indexOf(entry.word, index + 1)
      }
    }
  }

  report.prompts.push(
    '词表只能拦截显性穿越词。请通读本章，标记所有"不属于公元前3世纪的可感元素"（器物、制度、度量、饮食、礼仪），每处给出替换方案或改写理由——这是方法论文档"史料锚定"的人工复核步骤。',
  )
  return report
}
