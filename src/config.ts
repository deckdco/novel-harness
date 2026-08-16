/**
 * 插件配置（cordis.yml config 节）。
 *
 * 所有小说项目路径走配置，代码零硬编码；files 下的相对路径相对于 root 解析，
 * 也允许绝对路径（如设定圣经在 v1 目录这类跨版本引用）。
 */
import z from '@deepseek-ai/schemastery'

export interface ProjectConfig {
  root: string
  files: {
    bible: string
    master: string
    outline: string
    methodology: string
    bridges: string
    /** 作者偏好档案：定稿反馈循环的沉淀物，任务卡自动携带。 */
    preference: string
  }
  chaptersDir: string
  /** 定稿文件夹：唯一正典。前情提要/检查器/进度默认只读它。 */
  finalVariant: string
  /** 竞写草稿变体（cc/ds/gemini 等）：当章竞技场，不定稿不算数。 */
  variants: string[]
  nearChapters: number
  coachMode: boolean
  anachronismLexicon: string[]
  anachronismWhitelist: string[]
}

export const Config: z<ProjectConfig> = z.object({
  root: z.string().required().description('小说项目根目录（绝对路径）'),
  files: z.object({
    bible: z.string().description('设定圣经路径（root 相对或绝对）'),
    master: z.string().description('总成稿/工程蓝图路径'),
    outline: z.string().description('卷纲路径'),
    methodology: z.string().description('写作方法论文档路径'),
    bridges: z.string().description('亮点桥段库路径'),
    preference: z.string().default('作者偏好档案.md').description('作者偏好档案路径（定稿反馈循环的沉淀物；文件可后建）'),
  }),
  chaptersDir: z.string().default('正文'),
  finalVariant: z.string().default('定稿').description('定稿文件夹名（chaptersDir 下）：唯一正典，前情提要/检查器/进度默认只读定稿'),
  variants: z.array(String).default(['cc 版', 'ds 版', 'gemini 版']).description('竞写草稿变体目录名（不含定稿），供 compare 并排与 save 指定'),
  nearChapters: z.number().default(5).description('前情提要的近章详摘窗口'),
  coachMode: z.boolean().default(false).description('教练模式：严格不代笔，拒绝生成类请求'),
  anachronismLexicon: z.array(String).default([]).description('追加的时代错漏词表'),
  anachronismWhitelist: z.array(String).default([]).description('豁免词（如允许使用的成语）'),
})
