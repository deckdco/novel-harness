# novel-harness

基于 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness) 的长篇小说写作辅助插件：**上下文引擎 + 章节规范化管理 + 检查器套件 + 多模型竞写对比**。

设计哲学是 harness engineering 的"给地图不给说明书"——插件不提供代笔工具，而是把正确的上下文（任务卡/前情提要/纪律约束）喂给模型，再用确定性检查器验证产出。千章长篇的上下文不可能全量塞进会话，本插件用"近章详摘 + 远章按卷粗摘"的前情提要塔解决。

## 六个工具

| 工具 | 用途 |
|---|---|
| `novel_bible_query` | 设定语料检索（设定圣经/总成稿/卷纲/桥段库），写前查设定、核对人物制度 |
| `novel_chapter_brief` | **核心**。本章任务卡：所在卷细纲、本章节拍、亮点桥段、前情提要塔、写作纪律与钩子模板 |
| `novel_chapters` | 章节管理 `create / save / list / progress`：统一命名（第NNN章_章名.md）、frontmatter 自动维护（wordcount/hooks/roles/status） |
| `novel_check` | 5 个检查器：钩子覆盖（连续3章无钩红线）、时代错漏词表、节奏统计+五问、黄金三章六问、工具人三问 |
| `novel_compare_versions` | cc/ds/gemini 同章三版并排对比（字数/钩子/开头/结尾 + 选优标准） |
| `novel_coach` | 教练模式（`coachMode: true` 开启）：证据式讲评 / 苏格拉底提问，不代笔 |

检查器的分工：`findings` 是确定性结果（词表命中、统计越界），`prompts` 是需要模型结合正文回答的方法论问题——语义判断交给模型，不假装能确定性完成。

## 快速开始

前置：Node.js ≥ 22（开发实测 24），dsh 通过 npx 运行。

```sh
cd novel-harness
npm install                      # 首次
npx @deepseek-ai/dsh web --patch ./cordis.yml
# 打开 http://127.0.0.1:3080，配置模型 API key 后即可对话
```

对话示例（第 4 章完整流程）：

```
用 novel_chapter_brief 拿第4章任务卡 → 按任务卡写正文（模型直接写）
→ 用 novel_chapters save 落盘（自动统计字数/维护元数据）
→ 用 novel_check 跑检查器 → 修订 → novel_compare_versions 对照历史
```

## 配置说明（cordis.yml 的 config 节）

```yaml
- insert:
    - id: novel-harness
      name: '/绝对路径/novel-harness/src/index.ts'   # 插件路径必须是绝对路径
      config:
        root: '/小说项目根目录'          # 卷纲/正文所在目录
        files:
          bible: '../v1/00_设定圣经.md'  # 相对 root 或绝对路径均可
          master: '存道-四部总成稿.md'
          outline: '存道-千章卷纲.md'    # 格式见下
          methodology: '存道-网文写作方法论.md'
          bridges: '存道-亮点桥段设计.md'
        chaptersDir: '正文'
        primaryVariant: 'cc 版'         # 主变体（前情提要/检查器默认对象）
        variants: ['cc 版', 'ds 版', 'gemini 版']
        nearChapters: 5                 # 前情提要近章窗口
        coachMode: false                # true = 教练不代笔模式
        anachronismLexicon: []          # 追加时代错漏词
        anachronismWhitelist: []        # 豁免词（如成语"纸上谈兵"）
```

通用性：所有路径走配置，换一本书只需改 `root` 与 `files`。`examples/cundao.cordis.yml` 是《存道》的完整实例。

## 卷纲格式约定

解析器对《存道-千章卷纲.md》的真实格式做了适配，宽容解析：

```markdown
# 第一部《止战》(Ch1–250)— 胜利线:外交+科技 | 天花板:信息≠权力
## 卷一·醒在齐宫(Ch1–42)·★信息天花板
- **一句话**: ...
- **3节**: ... Ch1「醒在火上」(穿越+粮市逼空) ...    ← 逐章节拍（可选）
- **机制**: ...            ← 变体命名（机制·天花板崩）按前缀匹配
- **卷尾钩**: ...          ← 变体命名（卷尾收束）同样支持
- **★互动设计**:
  - **金句**: ...
```

无法识别的字段原样收进 `fields`，随任务卡透出，不丢信息。

## 章节文件规范

- 命名：`第NNN章_章名.md`（三位零填充），目录按卷 `卷一·醒在齐宫/`
- frontmatter：`type / tags / status / created / summary / chapter / volume / wordcount / hooks / roles`
- `summary` 是前情提要塔的数据源——**每章保存时务必提供一句话摘要**
- 兼容读取历史命名：`第 1章 · 醒在火上.md`（ds 版）、`第 1 章 醒在沸锅.md`（gemini 版）

## 开发

```sh
npm test                 # vitest，46 个用例
npx tsc --noEmit         # 类型检查
node --experimental-strip-types --no-warnings scripts/validate-real.ts   # 真实数据端到端验证
```

注意事项（踩过的坑）：
- dsh 的 TS 加载是 Node 原生 **strip-only 模式**：不支持构造函数参数属性（`constructor(readonly x)`）、enum 等；`@deepseek-ai/*` 依赖需装在插件自己的 `node_modules`（绝对路径加载按标准 ESM 规则解析）
- dsh-tools 输出 schema：自由 JSON 用 `{ type: 'json' }`；`{ type: 'object' }` 要求 `additionalProperties`
- 被 serialize 的数据类型用 `type` 别名而非 `interface`（interface 无隐式索引签名，赋不进 `JsonValue`）

## 发布（后续）

按官方 [打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md) 流程：npm 包 + `dsh.bundle` manifest + `cordis.patch.yml`（按包名引用插件行），GitHub 打上 `dsh-plugin` topic。
