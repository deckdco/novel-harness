/**
 * 章节文件命名规范与历史变体兼容。
 *
 * 规范名：第NNN章_章名.md（cc 版已采用）。
 * 兼容读取 ds 版（第 1章 · 醒在火上.md）与 gemini 版（第 1 章 醒在沸锅.md）。
 */

export interface ChapterFileNameInfo {
  chapter: number
  title: string
}

const CHAPTER_FILE_RE = /^第\s*(\d+)\s*章\s*(?:[·_\-—]\s*)?(.+?)\.md$/

export function parseChapterFileName(fileName: string): ChapterFileNameInfo | null {
  const match = CHAPTER_FILE_RE.exec(fileName)
  if (!match) return null
  const title = match[2].trim()
  if (title === '') return null
  return { chapter: Number.parseInt(match[1], 10), title }
}

export function buildChapterFileName(chapter: number, title: string): string {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').trim()
  return `第${String(chapter).padStart(3, '0')}章_${safeTitle}.md`
}
