# novel-harness

基于 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness) 的长篇小说写作辅助插件：**上下文引擎 + 竞写选稿工作台 + 章节规范化管理 + 检查器套件**。

设计哲学是 harness engineering 的"给地图不给说明书"——插件不提供代笔工具，而是把正确的上下文（任务卡/前情提要/纪律约束）喂给模型，再用确定性检查器验证产出。千章长篇的上下文不可能全量塞进会话，本插件用"近章详摘 + 远章按卷粗摘"的前情提要塔解决。

## 工作流核心约定：定稿中心制 + 偏好反馈循环

本插件围绕"三方竞写、人工定稿、反馈学习"的真实工作流构建：

1. **每章三方竞写**：Claude Code(glm-5.2) / DeepSeek / Gemini 各写一版，落进 `cc 版 / ds 版 / gemini 版` 草稿文件夹——它们只是**当章竞技场**，不是三套平行正文
2. **人工选稿**：用 `novel_compare_versions` 并排对比；可直接选定，也可受启发重新生成再选；融合多稿时以最优稿为底改写
3. **定稿归档**：用 `novel_chapters finalize` 把选中的稿（或融合改写稿）归档进定稿文件夹
4. **上下文只认定稿**：前情提要塔、检查器、进度统计**默认只读定稿文件夹**——未定稿的草稿不算已发生剧情
5. **偏好反馈循环**：定稿对草稿的修改是作者偏好证据——`novel_feedback digest` 生成反馈包喂给三方初稿生成方（ds/gemini 直接粘贴，cc 走任务卡），归纳出的规则 `distill` 进偏好档案，此后每章任务卡自动携带——初稿越写越合口味
6. **卷纲随定稿演化**：卷纲是活文档，根据定稿内容人工修订；插件按文件 mtime 自动重载，长会话不会读到旧卷纲

## 七个工具

| 工具 | 用途 |
|---|---|
| `novel_bible_query` | 设定语料检索（设定圣经/总成稿/卷纲/桥段库），写前查设定、核对人物制度 |
| `novel_chapter_brief` | **核心**。本章任务卡：所在卷细纲、本章节拍、亮点桥段、前情提要塔（只读定稿）、作者偏好档案、写作纪律与钩子模板；前章未定稿时给出缺口警告 |
| `novel_chapters` | 章节管理 `create / save / finalize / list / progress`：统一命名（第NNN章_章名.md）、frontmatter 自动维护；**finalize = 草稿→定稿归档**（唯一正典写入动作） |
| `novel_check` | 5 个检查器：钩子覆盖（连续3章无钩红线）、时代错漏词表、节奏统计+五问、黄金三章六问、工具人三问。默认查定稿，也可显式传 variant 查某份草稿 |
| `novel_compare_versions` | 竞写选稿工作台：cc/ds/gemini 草稿并排（字数/钩子/开头/结尾）+ 该章定稿状态 + 选优标准 |
| `novel_feedback` | **偏好反馈循环**。digest=定稿vs草稿的段落级差异证据→可粘贴反馈包；distill=偏好规则写入作者偏好档案 |
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

每章完整流程（三方竞写工作流）：

```
① novel_chapter_brief 拿第N章任务卡（前情提要只读定稿；有缺口警告先补定稿）
② 三方各写一版（本会话直接写 / 其他工具写完放进草稿文件夹均可，外部写入靠 mtime 签名自动感知）
③ novel_compare_versions 并排对比 → 选定或受启发重写
④ novel_chapters finalize 归档进定稿（content 参数可提交融合改写稿；建议给 summary/hooks——前情提要塔依赖）
⑤ novel_feedback digest 生成偏好反馈包 → 粘贴给 ds/gemini，本会话模型直接读；
   归纳出 3–8 条偏好规则后 novel_feedback distill 存档（此后任务卡自动携带）
⑥ novel_check 查定稿 → 修订（save）→ 视需要修订卷纲（直接编辑文件，自动重载）
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
          preference: '存道-作者偏好档案.md'  # 偏好反馈循环沉淀（可后建，distill 自动创建）
        chaptersDir: '正文'
        finalVariant: '定稿'            # 定稿文件夹：唯一正典，recap/检查器/进度默认只读它
        variants: ['cc 版', 'ds 版', 'gemini 版']  # 竞写草稿变体（不含定稿）
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
- 目录结构：`正文/定稿/…`（唯一正典）与 `正文/cc 版/…` 等草稿变体并列
- frontmatter：`type / tags / status / created / summary / chapter / volume / wordcount / hooks / roles`，finalize 额外写 `finalized / finalizedFrom`（定稿日期与来源草稿——偏好反馈循环靠它溯源配对）
- `summary` 是前情提要塔的数据源——**每章定稿时务必提供一句话摘要**
- 作者偏好档案（`files.preference`）：`novel_feedback distill` 维护，任务卡自动携带，也可直接手改
- 兼容读取历史命名：`第 1章 · 醒在火上.md`（ds 版）、`第 1 章 醒在沸锅.md`（gemini 版）
- 草稿由外部工具随时写入/覆盖，章节缓存按「路径+mtime 签名」校验，自动感知变化

## 开发

```sh
npm test                 # vitest，63 个用例
npx tsc --noEmit         # 类型检查
node --experimental-strip-types --no-warnings scripts/validate-real.ts   # 真实数据端到端验证（只读）
```

注意事项（踩过的坑）：
- dsh 的 TS 加载是 Node 原生 **strip-only 模式**：不支持构造函数参数属性（`constructor(readonly x)`）、enum 等；`@deepseek-ai/*` 依赖需装在插件自己的 `node_modules`（绝对路径加载按标准 ESM 规则解析）
- dsh-tools 输出 schema：自由 JSON 用 `{ type: 'json' }`；`{ type: 'object' }` 要求 `additionalProperties`
- 被 serialize 的数据类型用 `type` 别名而非 `interface`（interface 无隐式索引签名，赋不进 `JsonValue`）

## 发布（后续）

按官方 [打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md) 流程：npm 包 + `dsh.bundle` manifest + `cordis.patch.yml`（按包名引用插件行），GitHub 打上 `dsh-plugin` topic。
