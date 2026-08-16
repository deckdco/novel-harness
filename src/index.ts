/**
 * novel-harness — DeepSeek Harness 长篇小说写作辅助插件
 *
 * 6 个工具：
 *   novel_bible_query      设定语料检索
 *   novel_chapter_brief    本章任务卡（上下文引擎核心）
 *   novel_chapters         章节规范化管理 create/save/finalize/list/progress
 *   novel_check            检查器套件（钩子/时代错漏/节奏/黄金三章/工具人）
 *   novel_compare_versions 同章竞写选稿工作台（草稿并排+定稿状态）
 *   novel_coach            教练模式（coachMode 开关）
 *
 * 工作流核心约定——定稿中心制：
 *   cc/ds/gemini 等变体是当章竞写草稿的竞技场，不定稿不算数；
 *   定稿文件夹是唯一正典，前情提要/检查器/进度默认只读定稿；
 *   卷纲是活文档，随定稿人工修订，插件按 mtime 自动重载。
 *
 * 设计哲学："给地图不给说明书"——工具提供确定性上下文与检查，
 * 正文由模型在会话中写作，不设代笔工具。
 */
import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.ts'
import type { ProjectConfig } from './config.ts'
import { Project } from './lib/project.ts'
import { bibleQueryTool } from './tools/bible-query.ts'
import { chapterBriefTool } from './tools/chapter-brief.ts'
import { chaptersTool } from './tools/chapters.ts'
import { checkTool } from './tools/check.ts'
import { coachTool } from './tools/coach.ts'
import { compareVersionsTool } from './tools/compare.ts'

export const name = 'novel-harness'
export const inject = ['tools']
export { Config }

export function apply(ctx: Context, config: ProjectConfig): void {
  const project = new Project(config)

  ctx.tools.register(bibleQueryTool(project))
  ctx.tools.register(chapterBriefTool(project))
  ctx.tools.register(chaptersTool(project))
  ctx.tools.register(checkTool(project))
  ctx.tools.register(compareVersionsTool(project))
  ctx.tools.register(coachTool(project))
}
