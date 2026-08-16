/**
 * 段落级文本差异：定稿 vs 草稿的偏好证据提取。
 *
 * 以空行分段，LCS 对齐未改动段；未对齐段按位置配对为「修改」，
 * 多出的草稿段计「删除」（作者删掉的内容=最强负向信号），
 * 多出的定稿段计「新增」（作者亲手补的内容=最强正向信号）。
 *
 * 只做确定性对齐，不做语义归纳——归纳是模型在 feedback 工具
 * 的 prompts 引导下完成的事。
 */

export interface ModifiedPair {
  draft: string
  final: string
}

export interface ParaDiff {
  modified: ModifiedPair[]
  added: string[]
  removed: string[]
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p !== '')
}

export function diffParagraphs(draftText: string, finalText: string): ParaDiff {
  const a = splitParagraphs(draftText) // 草稿段
  const b = splitParagraphs(finalText) // 定稿段
  const n = a.length
  const m = b.length

  // LCS 长度表（段数通常 <100，DP 无压力）
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const modified: ModifiedPair[] = []
  const added: string[] = []
  const removed: string[] = []
  const removedRun: string[] = []
  const addedRun: string[] = []

  const flush = (): void => {
    const paired = Math.min(removedRun.length, addedRun.length)
    for (let x = 0; x < paired; x++) modified.push({ draft: removedRun[x], final: addedRun[x] })
    for (let x = paired; x < removedRun.length; x++) removed.push(removedRun[x])
    for (let x = paired; x < addedRun.length; x++) added.push(addedRun[x])
    removedRun.length = 0
    addedRun.length = 0
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush()
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removedRun.push(a[i])
      i++
    } else {
      addedRun.push(b[j])
      j++
    }
  }
  while (i < n) removedRun.push(a[i++])
  while (j < m) addedRun.push(b[j++])
  flush()

  return { modified, added, removed }
}

/** 摘录截断（保留开头，标注截断）。 */
export function clip(text: string, limit: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > limit ? `${t.slice(0, limit)}…` : t
}
