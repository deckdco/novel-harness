/** 检查器公共接口。 */
import type { ChapterFile, Project } from '../lib/project.ts'

export type CheckLevel = 'error' | 'warn' | 'info'

export type CheckFinding = {
  level: CheckLevel
  message: string
}

export type CheckReport = {
  checker: string
  description: string
  findings: CheckFinding[]
  /** 交给模型/人回答的方法论问题（语义判断无法确定性完成时） */
  prompts: string[]
}

export interface CheckContext {
  project: Project
  /** 被检查章节（按章号升序）；部分检查器会参考主变体的已写章节做上下文 */
  chapters: ChapterFile[]
}
