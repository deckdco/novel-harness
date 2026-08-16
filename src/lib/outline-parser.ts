/**
 * 千章卷纲解析器。
 *
 * 目标格式（见《存道》卷纲的真实结构）：
 *   # 第一部《止战》(Ch1–250)— 胜利线:外交+科技 | 天花板:信息≠权力
 *   ## 卷一·醒在齐宫(Ch1–42)·★信息天花板
 *   - **一句话**: ... / - **3节**: ... Ch1「醒在火上」(穿越+粮市逼空) ... / - **机制**: ... / - **卷尾钩**: ... / - **★互动设计**: （缩进子条目）
 *
 * 逐章节拍（ChN「章名」(节拍)）嵌在 3节 字段文本中，单独提取。
 * 解析保持宽容：无法识别的字段原样收进 fields，不抛错。
 */

export type ChapterBeat = {
  chapter: number
  title: string
  beats: string
}

export type VolumeOutline = {
  part: string
  partTitle: string
  partTagline: string
  volumeIndex: number
  volumeLabel: string
  title: string
  chStart: number
  chEnd: number
  annotations: string[]
  oneline?: string
  sections?: string
  mechanism?: string
  endHook?: string
  interactive?: string
  fields: Record<string, string>
  chapterBeats: ChapterBeat[]
}

export type Outline = {
  title: string
  volumes: VolumeOutline[]
}

const PART_RE = /^#\s*(第[一二三四五六七八九十]{1,2}部)《(.+?)》\(Ch(\d+)\s*[–—-]\s*(\d+)\)\s*(?:[—-]\s*(.*))?$/
const VOLUME_RE = /^##\s*卷([一二三四五六七八九十]{1,3})·(.+?)\(Ch(\d+)\s*[–—-]\s*(\d+)\)(.*)$/
const FIELD_RE = /^-\s*\*\*(.+?)\*\*[:：]?\s*(.*)$/
const BEAT_RE = /Ch(\d+)「([^」]+)」\(([^)]*)\)/g

const CN_DIGITS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

export function chineseNumeralToArabic(text: string): number | null {
  if (text === '十') return 10
  const tenIndex = text.indexOf('十')
  if (tenIndex === -1) {
    return CN_DIGITS[text] ?? null
  }
  const tens = tenIndex === 0 ? 1 : CN_DIGITS[text[tenIndex - 1]]
  const ones = tenIndex + 1 < text.length ? CN_DIGITS[text[tenIndex + 1]] : 0
  if (tens === undefined || ones === undefined) return null
  return tens * 10 + ones
}

/** 字段名匹配用前缀规则：兼容 "机制·天花板崩"、"卷尾收束" 等变体命名。 */
function namedFieldFor(name: string): keyof VolumeOutline | null {
  if (name.startsWith('一句话')) return 'oneline'
  if (name.startsWith('3节') || name.startsWith('三节')) return 'sections'
  if (name.startsWith('机制')) return 'mechanism'
  if (name.startsWith('卷尾')) return 'endHook'
  if (name.includes('互动设计')) return 'interactive'
  return null
}

export function parseOutline(md: string): Outline {
  const lines = md.split(/\r?\n/)
  const volumes: VolumeOutline[] = []
  let title = ''
  let currentPart = { label: '', titleText: '', tagline: '' }
  let current: VolumeOutline | null = null

  for (const line of lines) {
    const part = PART_RE.exec(line)
    if (part) {
      currentPart = { label: part[1], titleText: part[2], tagline: part[5] ?? '' }
      current = null
      continue
    }
    if (!currentPart.label && /^#\s+/.test(line) && volumes.length === 0) {
      title = line.replace(/^#\s+/, '').trim()
      continue
    }
    const volume = VOLUME_RE.exec(line)
    if (volume) {
      const volumeIndex = chineseNumeralToArabic(volume[1])
      if (volumeIndex === null) continue
      const annotations = volume[5].split('·').map(s => s.trim()).filter(s => s !== '')
      current = {
        part: currentPart.label,
        partTitle: currentPart.titleText,
        partTagline: currentPart.tagline,
        volumeIndex,
        volumeLabel: `卷${volume[1]}`,
        title: volume[2],
        chStart: Number.parseInt(volume[3], 10),
        chEnd: Number.parseInt(volume[4], 10),
        annotations,
        fields: {},
        chapterBeats: [],
      }
      volumes.push(current)
      continue
    }
    if (current === null || line.trim() === '') continue
    if (/^#{1,6}\s/.test(line)) { current = null; continue }

    const field = FIELD_RE.exec(line)
    if (field) {
      const name = field[1]
      const value = field[2]
      current.fields[name] = value
      const named = namedFieldFor(name)
      if (named) Object.assign(current, { [named]: value })
      continue
    }
    // 互动设计的缩进子条目延续上一字段
    if (/^\s+-/.test(line)) {
      const keys = Object.keys(current.fields)
      const last = keys[keys.length - 1]
      if (last) {
        current.fields[last] += `\n${line.trim()}`
        const named = namedFieldFor(last)
        if (named) Object.assign(current, { [named]: current.fields[last] })
      }
    }
  }

  for (const volume of volumes) {
    const text = volume.sections ?? ''
    for (const match of text.matchAll(BEAT_RE)) {
      volume.chapterBeats.push({
        chapter: Number.parseInt(match[1], 10),
        title: match[2],
        beats: match[3],
      })
    }
  }

  return { title, volumes }
}

/** 章号落在某卷范围内返回该卷；落在卷间空隙或超界返回 null。 */
export function findVolumeForChapter(outline: Outline, chapter: number): VolumeOutline | null {
  return outline.volumes.find(v => chapter >= v.chStart && chapter <= v.chEnd) ?? null
}
