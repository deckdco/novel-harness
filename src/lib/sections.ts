/**
 * Markdown 章节切分与检索。
 *
 * 把文档按标题切成 Section 树（保留父级标题路径），
 * 供设定查询（bible_query）与方法论/纪律提取（chapter_brief）复用。
 */

export interface Section {
  level: number
  heading: string
  /** 祖先标题（不含自身），如 ['第一部《止战》', '卷一·醒在齐宫'] */
  path: string[]
  /** 标题行之后到下一个任意级标题之前的内容 */
  content: string
  line: number
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/

export function splitSections(md: string): Section[] {
  const lines = md.split(/\r?\n/)
  const sections: Section[] = []
  const stack: { level: number, heading: string }[] = []
  let current: Section | null = null
  let buffer: string[] = []

  const flush = (endLine: number): void => {
    if (current) current.content = buffer.join('\n').trim()
    void endLine
  }

  for (let i = 0; i < lines.length; i++) {
    const match = HEADING_RE.exec(lines[i])
    if (match) {
      flush(i)
      const level = match[1].length
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
      current = {
        level,
        heading: match[2].trim(),
        path: stack.map(s => s.heading),
        content: '',
        line: i + 1,
      }
      sections.push(current)
      stack.push({ level, heading: current.heading })
      buffer = []
    } else if (current) {
      buffer.push(lines[i])
    }
  }
  flush(lines.length)
  return sections
}

/** 标题命中优先于正文命中；返回按相关度排序的结果。 */
export function searchSections(sections: Section[], keyword: string, limit = 8): Section[] {
  const headingHits = sections.filter(s => s.heading.includes(keyword))
  const contentHits = sections.filter(s => !s.heading.includes(keyword) && s.content.includes(keyword))
  return [...headingHits, ...contentHits].slice(0, limit)
}

/** 按标题关键词取单个章节（如 '十、' 匹配 "十、《存道》专用的写作纪律"）。 */
export function findSection(sections: Section[], headingKeyword: string): Section | null {
  return sections.find(s => s.heading.includes(headingKeyword)) ?? null
}
