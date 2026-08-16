/** novel_chapter_brief：本章任务卡 = 上下文引擎的核心输出。 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { Project } from '../lib/project.ts'
import { buildRecap } from '../lib/recap.ts'

export function chapterBriefTool(project: Project) {
  return defineTool({
    name: 'novel_chapter_brief',
    description:
      '组装"本章任务卡"：所在卷的卷纲细纲、本章节拍（若有）、本卷亮点桥段、前情提要（近章详摘+远章按卷粗摘）、写作纪律与钩子模板。动笔写第 N 章前必须先调用本工具获取完整上下文。',
    parameters: {
      chapter: { type: 'number', required: true, description: '要写的章号' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args): Promise<JsonValue> {
      const chapter = args.chapter
      const volume = project.volumeForChapter(chapter)
      if (!volume) {
        return {
          error: `第${chapter}章不在任何卷的章节范围内`,
          volumes: project.outline.volumes.map(v => ({
            volume: v.volumeLabel,
            title: v.title,
            range: `Ch${v.chStart}–${v.chEnd}`,
          })),
        }
      }

      const beat = volume.chapterBeats.find(b => b.chapter === chapter) ?? null
      const scenes = project.bridgesScenes(volume)
      const discipline = project.methodologySection('十、')
      const hookTemplates = project.methodologySection('3.1')
      const recap = buildRecap(project, chapter, project.config.nearChapters)

      return {
        chapter,
        volume: {
          label: volume.volumeLabel,
          title: volume.title,
          part: `${volume.part}《${volume.partTitle}》`,
          partTagline: volume.partTagline,
          chapterRange: `Ch${volume.chStart}–${volume.chEnd}`,
          annotations: volume.annotations,
          oneline: volume.oneline ?? '',
          sections: volume.sections ?? '',
          mechanism: volume.mechanism ?? '',
          endHook: volume.endHook ?? '',
          interactive: volume.interactive ?? '',
          fields: volume.fields,
        },
        chapterBeat: beat,
        bridgeScenes: scenes,
        recap,
        disciplines: {
          writing: discipline ? discipline.content.slice(0, 2000) : null,
          hookTemplates: hookTemplates ? hookTemplates.content.slice(0, 1500) : null,
        },
        golden3Checklist: chapter <= 3
          ? '黄金三章期：本章须满足方法论§2.2 六问（任务卡提示：300字内进场景/亮技或碰壁/章尾必有钩）'
          : '',
      }
    },
  })
}
