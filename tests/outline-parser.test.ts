import { describe, expect, it } from 'vitest'
import { findVolumeForChapter, parseOutline } from '../src/lib/outline-parser.ts'

/** 从《存道-千章卷纲.md》截取的真实结构（保留原始格式特征） */
const FIXTURE = `# 《存道》· 千章卷纲(修订版 v5)

## ■ 修订日志
- v2: 商业节奏修订
- v5: 读者互动工程

# 第一部《止战》(Ch1–250)— 胜利线:外交+科技 | 天花板:信息≠权力

## 卷一·醒在齐宫(Ch1–42)
- **一句话**:穿越落地,粮市破局,金手指前置亮技。
- **3节**:①(Ch1–14)黄金三章+立足:Ch1「醒在火上」(穿越+粮市逼空+第一秒亮技+年代觉醒);Ch2「破局」(反逼空碾压+打脸+**阿蘅以合伙人登场**);Ch3「倒计时」(立灭宋stakes+**记忆有裂缝·埋金手指失效**+苏秦悬念+锁定止战)。②(Ch15–28)朝堂初入·小试牛刀打脸循环。③(Ch29–42)初立名+苏秦登场埋刺。
- **机制**:粮市逼空=**粮价的金融操纵**;主角第一次展现"粮锤/资源"操作系统。
- **卷尾钩**:伐宋廷议在即;苏秦的笑意味深长。
- **★互动设计**:
  - **倒计时#1**:Ch1主角穿越后第一份情报,"秦军三十万"。
  - **金句**:现实映射链启动(粮市逼空→A股逼空/GameStop)。

## 卷二·孤臣进谏(Ch43–84)·★信息天花板
- **一句话**:用现代地缘学进谏,当众受辱。
- **机制**:他看得见科技树与胜利线,但按不了按钮。
- **卷尾钩**:暗流指向一个不可能的人。
- **★互动设计**:
  - **争议炸弹#1**:Ch70左右,主角确认苏秦是燕国死间后做出选择。

# 第二部《振齐》(Ch251–500)— 胜利线:科技+资源 | 天花板:资本≠暴力

## 卷七·废墟临淄(Ch251–292)
- **一句话**:战后重建。
- **3节**:①(Ch251–262)废墟清理:Ch251「灰烬」(清点损失)。
- **机制·变体命名**:前缀匹配兜底。
- **卷尾收束**:第一炉铁水。
- **跨部钩**:走向何方。
`

describe('parseOutline', () => {
  const outline = parseOutline(FIXTURE)

  it('解析文档标题', () => {
    expect(outline.title).toContain('千章卷纲')
  })

  it('解析卷数量与卷号', () => {
    expect(outline.volumes).toHaveLength(3)
    const [v1, v2, v7] = outline.volumes
    expect(v1.volumeIndex).toBe(1)
    expect(v2.volumeIndex).toBe(2)
    expect(v7.volumeIndex).toBe(7)
    expect(v7.title).toBe('废墟临淄')
  })

  it('解析卷的章节范围与归属部', () => {
    const v2 = outline.volumes[1]
    expect(v2.chStart).toBe(43)
    expect(v2.chEnd).toBe(84)
    expect(v2.part).toContain('第一部')
    expect(v2.partTitle).toBe('止战')
    const v7 = outline.volumes[2]
    expect(v7.partTitle).toBe('振齐')
  })

  it('解析卷尾标注（可多个）', () => {
    expect(outline.volumes[1].annotations).toEqual(['★信息天花板'])
    expect(outline.volumes[0].annotations).toEqual([])
  })

  it('解析正文字段', () => {
    const v1 = outline.volumes[0]
    expect(v1.oneline).toContain('穿越落地')
    expect(v1.mechanism).toContain('粮市逼空')
    expect(v1.endHook).toContain('伐宋廷议')
    expect(v1.interactive).toContain('倒计时#1')
  })

  it('提取逐章节拍', () => {
    const v1 = outline.volumes[0]
    expect(v1.chapterBeats.map(b => b.chapter)).toEqual([1, 2, 3])
    const ch1 = v1.chapterBeats[0]
    expect(ch1.title).toBe('醒在火上')
    expect(ch1.beats).toContain('粮市逼空')
    const v7 = outline.volumes[2]
    expect(v7.chapterBeats[0].chapter).toBe(251)
  })

  it('变体字段名（机制·xxx / 卷尾收束 / 跨部钩）按前缀映射，不漏进 fields 之外的信息', () => {
    const v7 = outline.volumes[2]
    expect(v7.mechanism).toBe('前缀匹配兜底。')
    expect(v7.endHook).toBe('第一炉铁水。')
    expect(v7.fields['跨部钩']).toBe('走向何方。')
    expect(Object.keys(v7.fields)).toContain('机制·变体命名')
  })
})

describe('findVolumeForChapter', () => {
  const outline = parseOutline(FIXTURE)

  it('按章号定位卷（含边界）', () => {
    expect(findVolumeForChapter(outline, 1)!.volumeIndex).toBe(1)
    expect(findVolumeForChapter(outline, 42)!.volumeIndex).toBe(1)
    expect(findVolumeForChapter(outline, 43)!.volumeIndex).toBe(2)
    expect(findVolumeForChapter(outline, 251)!.volumeIndex).toBe(7)
    expect(findVolumeForChapter(outline, 292)!.volumeIndex).toBe(7)
  })

  it('卷间空隙返回 null（Ch85–250 无卷数据，不误归前卷）', () => {
    expect(findVolumeForChapter(outline, 85)).toBeNull()
    expect(findVolumeForChapter(outline, 300)).toBeNull()
  })

  it('超界返回 null', () => {
    expect(findVolumeForChapter(outline, 10000)).toBeNull()
  })
})
