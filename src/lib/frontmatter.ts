/**
 * 极简 YAML frontmatter 解析/序列化。
 *
 * 只支持章节文件实际用到的子集：标量（字符串/整数/日期）与行内数组 [a, b, c]。
 * 有意不引入 YAML 依赖，保证插件零第三方运行时依赖（dsh 加载器环境无关）。
 */

export type FrontmatterValue = string | number | string[]

export interface SplitResult {
  data: Record<string, FrontmatterValue>
  body: string
}

const DELIMITER = /^---\r?$/

function parseValue(key: string, raw: string): FrontmatterValue {
  const text = raw.trim()
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim()
    if (inner === '') return []
    return inner.split(',').map(s => s.trim()).filter(s => s !== '')
  }
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10)
  void key
  return text
}

export function splitFrontmatter(raw: string): SplitResult | null {
  const lines = raw.split(/\r?\n/)
  if (lines.length === 0 || !DELIMITER.test(lines[0])) return null
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) { end = i; break }
  }
  if (end === -1) return null

  const data: Record<string, FrontmatterValue> = {}
  for (const line of lines.slice(1, end)) {
    if (line.trim() === '') continue
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim()
    const value = parseValue(key, line.slice(colon + 1))
    if (key !== '') data[key] = value
  }
  return { data, body: lines.slice(end + 1).join('\n') }
}

function serializeValue(value: FrontmatterValue): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`
  return String(value)
}

export function serializeFrontmatter(data: Record<string, FrontmatterValue>): string {
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${serializeValue(value)}`)
    .join('\n') + '\n'
}

/** 合并 patch 到原文 frontmatter，保留正文与其余字段不动。 */
export function updateFrontmatter(raw: string, patch: Record<string, FrontmatterValue>): string {
  const parsed = splitFrontmatter(raw)
  const body = parsed?.body ?? raw
  const merged = { ...(parsed?.data ?? {}), ...patch }
  return `---\n${serializeFrontmatter(merged)}---\n${body}`
}
