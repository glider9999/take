# Take 开源多厂商 AI 群聊客户端 · 定版框架（合并版）

> 定版日期：2026-11-03
> 状态：已经 Sunny 两轮终审通过，为当前唯一执行口径；与 Crosswalk 房内旧帖冲突处，以本文为准。
> 来源材料：工单 #dsk6s7（已被 #h3q4ur 取代）、第一稿 #plkhoi（内核）、终审 #ekdnw6、补稿 #o61cqg（形态层）、终审 #lel5q3（通过＋两条实施备注）、版本范围补充 #go1ku9。
> 仓库：glider9999/take（已建，Public）｜产品名：Take｜许可证：Apache-2.0
> 说明：文中量化数字凡标［未核实估算］者均为估算，不作承诺；标［已核实］者为已查证事实。

---

## 一、产品定义

Take 是一个开源的群聊式 AI 协作客户端，**面向所有 AI 用户，不限行业**：写代码、写文案、做调研、做视觉，任何工作都可以把多个 Agent 拉进同一个群里分工协作。它由 AI 影像创作场景发起（发起人正是在做视觉时发现每个 Agent 各有优势、多 Agent 群聊最顺手），take.hk 是它的分享与引流渠道，不是它的边界（与 Take 一贯口径一致：受众不框定为创作者，谁都可以用）：

- 像早期 QQ 一样，左侧是联系人/群列表，右侧是聊天窗；把多家 AI（Claude、ChatGPT、Gemini、Grok、Kimi、DeepSeek 等）拉进同一个群，共享上下文、互相看得见对方发言，接力完成一个项目。
- 每个环节由最擅长的 Agent 负责：例如 Claude 写提示词、Grok Bot / 本地 CLI 搭工作流、ChatGPT 出分镜图。位置可换人，谁擅长谁上。
- 与 Grix 的区隔［已核实］：Grix 是单家产品、Grix Source-Available License 1.0（仅非商业，商用/托管/企业内部使用均禁止，须 kf@grix.im 书面授权）、以编程 CLI 为主；Take 是多厂商 API＋CLI 混合、Apache-2.0 真开源、面向所有人。本项目 Clean-room 独立设计，不 Fork、不引用 Grix 任何代码与商标。

## 二、版本范围（首发）

1. **浏览器版（轻装版）**：纯前端 Web 应用，打开网页即用；只连云端 API 模型，Key 存浏览器本地；不含本地 CLI 与本地 ComfyUI（浏览器沙箱碰不到本机程序，是形态边界）。托管用 GitHub Pages（仓库自带、免费静态、零中心服务器，逻辑全在访客浏览器内运行），不占 take.hk 资源。
2. **本地部署版（完全版）**：Tauri v2 桌面客户端为主，Docker 本地 Web 为辅；API＋本地 CLI/ACP＋ComfyUI 联动＋系统钥匙串，全能力；Key 与数据只存本机，无中心服务器。
3. 两版共用同一套群聊引擎、适配层与界面（Monorepo 的 engine/adapters 共享，外壳分两个）；数据模型与 Agent Schema 不变，浏览器版只是少了本地 CLI 与本地工具两类适配器。
4. **安卓 / iOS 后置**，首发不做，框架不为移动端预留改造。

## 三、界面设计分工

- **聊天对话框与全部界面视觉由 Sunny 出样张、用户拍板定稿，开发方按定稿图施工，不自行改视觉**（Take 既有规矩：先样张，后上线）。
- 已有样张 v1：`chat-ui-mockup-v1.html`（take.hk 同源视觉：纸色 #FAF7F0、墨色 #1C1A17、朱红 #C8402A、赭金 #7C5A24、田字交叉 logo 标），含左侧会诊室＋专家联系人、中间群聊流、右侧进度与花费保险丝、底部输入区（@ 按钮＋会诊模式开关）。
- 落地到两个版本时由 Sunny 再出客户端版样张：去掉浏览器外框与网站顶栏、换客户端原生标题栏；浏览器版与本地版共用同一套对话框设计。
- Gemini / 开发方只负责技术实现，不负责视觉设计。

## 四、总体架构（本地优先）

选型裁定：**Tauri v2 桌面客户端为主**（否决纯本地 Web 为主形态：浏览器沙箱无法常驻拉起和管理本地 CLI 进程，且要求创作者自装 Node/Docker、心智门槛高）。Tauri 以 Rust 驱动系统原生 Webview，对比 Electron 显著更轻（打包约 15~20MB、空闲内存约 30~50MB［未核实估算］），双击安装、零环境依赖；Docker 本地 Web 模式作为第二形态保留。浏览器版为纯前端形态，与本地版共享引擎（见第二节）。

```text
[ 用户本地机器 — 零中心服务器 ]
  视觉与交互层（Webview / 浏览器，Take 视觉）
    左侧：联系人列表（多厂商 Agent）＋会诊室群组
    右侧：群聊主界面（多 Agent 并发流式气泡、打字状态、单聊/广播切换）
    状态栏：本会话 Token 消耗估算、各厂商 Key 状态、本地提醒
  本地编排核心（Tauri Core / 前端引擎）
    1. 统一联系人适配总线（Contact Bus）
       ├─ 云端 API 适配器（OpenAI 兼容 / Anthropic / Gemini 等）
       └─ 本地 CLI 适配器（见第六节，分 ACP 协议与 PTY 包装两类）
    2. 群聊上下文引擎（见第五节）
    3. 本地工具分发器：ComfyUI（127.0.0.1:8188）、搜索、文件与沙箱执行
    4. 本地存储与凭据：SQLite（记录/Agent 预设/账本）＋系统原生凭据库
  网络出口（严格直连，无中间人）
    ├─ 各厂商官方 API（用户自备 Key）
    └─ 本地环回地址（ComfyUI 等本地工具）
```

## 五、群聊上下文引擎（内核）

- 三种触发：**广播**（会诊模式，全员作答）、**@点名**（默认单聊，只唤醒被点名的 Agent）、**接力**（上一个 Agent 的成果作为下一个的输入上下文）。
- **防死循环**：单个用户消息触发后，每个 Agent 最多响应 1 次；调度层物理切断 Agent 之间的互相触发，Agent 不能互相 @ 或连环唤醒。
- **上下文管理**：注入每个模型的历史严格只取最近 10 条明文，更早内容压缩为 200 字以内摘要；单轮成本因此进入稳态、不随轮次膨胀（测算见第十节）。
- **单轮防重入锁**：本轮全部 Agent 输出完毕（或超时）前，不接受下一次触发，防止并发爆炸。

## 六、Agent 联系人体系与适配层

### 1. 统一联系人抽象（Contact）

无论底层是云端模型还是本地进程，统一封装为联系人：`contact_id`、昵称/头像、`send_message(history, prompt, tools)`（异步流式返回）、`abort_execution()`（中断单个 Agent）。

### 2. 两条驱动线

- **云端 API 线**：DeepSeek、Claude、GPT、Gemini、Kimi、豆包等；走厂商官方 API（支持自定义 Base URL 与自填 Key），SSE 流解析为内部帧推给气泡组件。
- **本地 CLI 线（实施备注：必须分两类）**：
  - **ACP 协议适配**：ACP 兼容 CLI（如 Claude Code、Cursor ACP）走结构化协议（JSON-RPC over stdio），不抓终端文本；
  - **PTY 包装适配**：非 ACP 的老式 CLI 用伪终端包装，ANSI 转义清洗后转成文本片段。
  （原框架稿曾将两类混写为「stdout＋ANSI 清洗」，定版以本条为准。）

### 3. Agent 配置 Schema（节选）

```text
AgentDefinition:
  id / name / avatar_url / category（prompt | workflow | cinematography）
  persona_profile: role_description / tone_style / constraints / system_instruction
  runtime_model: provider / model_version / temperature / top_p / max_tokens（硬顶 1,000~1,500）
  tool_permissions: 按第九节三级权限，默认最低
  context_control: max_history_turns = 10 / max_context_tokens = 4,000
```

### 4. 预设会诊室与自定义（定位补充，2026-11-03）

- **自定义是一等功能**：任何用户都可以自建房间、按第六节 Schema 添加任意 Agent（任意厂商 API 或本地 CLI），产品不预设行业。
- **官方首发预设包（示例性质）**：提示词会诊室、ComfyUI 报错会诊室、分镜与镜头会诊室——来自发起人的影像工作流，作用是示范「多 Agent 分工」怎么玩，并作为 take.hk 引流时的展示样本；另配一个无行业属性的「通用会诊室」（默认拉入 3 个主流模型）作为新用户首站。
- 后续可按社区贡献增加其他行业预设包（编程、写作、调研等），机制与影像包相同。

## 七、通信与流式渲染

- 本地版内部与 Docker Web 模式采用 WebSocket（WSS）长连接；Tauri 桌面版以等价的 IPC 事件实现同一套帧协议；浏览器版为前端内直连厂商 SSE，帧语义保持一致。
- 帧类型：`typing`（打字状态）→ `chunk`（流式片段，按 turn＋agent_id 路由）→ `agent_done`（单 Agent 结束，带 Token 统计）→ `turn_done`（全轮闭环，前端解锁发送）。
- 前端按 `turn_index + agent_id` 维护独立气泡组件：慢思考模型不阻塞快模型，各自独立渲染与滚动。

## 八、数据模型（本地存储，SQLite）

五实体（源自第一稿，改为本地版）：

- **User（本地档案）**：id、显示名、本地偏好、自定义预算警戒线（见第十节）。无站方账号体系。
- **Room（会诊室）**：id、slug（如 prompt-clinic / comfyui-fix / storyboard-lens）、名称、说明、默认模式（mention_only / broadcast）、入驻 Agent 数组。
- **Agent**：见第六节 Schema。
- **Session（会话）**：id、room_id、标题、进场上下文（external_context，如从工作流页面带入的标题/链接）、累计 Token、警戒线状态、更新时间。
- **Message**：id、session_id、turn_index、sender_type（user/agent/system/tool）、sender_id、content、tokens_input、tokens_output、status（pending/streaming/completed/failed）、时间戳。

## 九、工具挂载与本地安全模型

### 1. 工具挂载

- 工具以 JSON Schema 元数据挂在 Agent 配置上；调用闭环：模型发出 tool_call → 本地调度器拦截执行 → 结果以 tool 消息回填上下文。
- 首发工具：ComfyUI 联动（读报错日志、查当前节点图，经 http://127.0.0.1:8188 ）、网页搜索（DuckDuckGo / SearXNG / Tavily 等）、本地文件读取（白名单目录）。

### 2. 安全模型（产品立身之本）

- **Key 零外泄**：无中心服务器，流量只在本机直连厂商官方端点，抓包可验；Key 强制存操作系统原生凭据库（macOS Keychain / Windows Credential Manager / Linux Secret Service），严禁明文落盘、严禁存浏览器 localStorage（本地版）；浏览器版 Key 存浏览器本地存储，安全等级低于本地版，README 须明示。
- **工具三级权限**：Level 1 只读轻量（公开搜索、端口状态）可自主执行；Level 2 本地感知（读白名单目录内的工作流文件、日志）首次授权目录白名单；**Level 3 破坏性操作（执行 Shell、改/覆文件、装插件）强制弹窗阻断，展示拟执行内容与目标路径，用户手动点「授权」才执行。**
- **沙箱**：本地 CLI 子进程锁定工作根目录，禁访 ~/.ssh、浏览器配置等敏感目录；网络白名单口径＝**厂商官方 API ＋用户显式启用的工具端点**（实施备注：含搜索等工具域名，不是只限厂商域名）。

## 十、成本机制（本地化）

- 费用由用户直接向各厂商结算（自备 Key），无站方熔断；客户端做**本地用量账本**：每次响应提取真实 usage（输入/输出 Token）记入 SQLite，按公开费率表［未核实估算］折算金额，在状态栏/仪表盘展示。
- 用户可自设警戒线（如单会话 50,000 tokens 或单日 $2）；逼近时黄色提醒，达到时输入框转锁定确认态（「已消耗约 X，是否继续？」），点继续放行——软提醒，不粗暴断流。
- 参考测算（沿用第一稿，全部［未核实估算］；假设：用户单问 200 tokens、单 Agent 单答 500 tokens、混合单价输入 ¥0.005/千、输出 ¥0.02/千）：无截断时单轮成本随轮次线性上涨（8 Agent 第 30 轮约 ¥2.48/轮）；启用近 10 条截断后进入稳态封顶：**3 Agent 约 ¥0.082/轮、6 Agent 约 ¥0.165/轮、8 Agent 约 ¥0.220/轮**，与轮次无关。

## 十一、仓库结构与安装

```text
glider9999/take/
├── .github/workflows/        # CI：跨平台打包（dmg/exe/AppImage）＋ GitHub Pages 部署（浏览器版）
├── apps/
│   ├── desktop/              # 本地版：Tauri v2（src 前端 + src-tauri Rust 宿主）
│   └── web/                  # 浏览器版：纯前端（GitHub Pages 发布）
├── packages/
│   ├── engine/               # 群聊上下文引擎（广播/@/接力、防死循环、窗口＋摘要）
│   ├── adapters/             # API 适配器 + CLI 适配器（ACP 协议 / PTY 包装）
│   └── tools/                # ComfyUI 联动、搜索等本地工具
├── docker/docker-compose.yml # Docker 本地 Web 模式（本地版的第二形态）
├── docs/                     # 创作者上手指南、各厂商 Key 获取教程
├── LICENSE                   # Apache-2.0
└── README.md
```

安装方式：①普通创作者：GitHub Releases 下载预编译安装包（macOS .dmg / Windows .exe / Linux .AppImage），双击运行、填 Key 即用；浏览器版直接开 GitHub Pages 网页。②开发者：Node.js ≥ 20 ＋ Rust 工具链，`pnpm install && pnpm tauri dev`。③Docker：`docker run -d -p 3000:3000 -v ~/.take-data:/app/data glider9999/take:latest` 后开 http://localhost:3000 。

## 十二、README 大纲

标语与徽章（Take — 人人可用的开源多智能体群聊客户端：把多家 AI 拉进一个群，分工干活）→ 为什么做 Take（单模型工具孤立、闭源工具限制严苛；Take 数据纯本地、多模型自由拉群分工、API 与本地 CLI 混编、完全开源；AI 影像只是发起场景之一，任何工作都适用）→ 核心特性（多厂商拉群会诊 / 纯本地安全 / API＋CLI 混编 / ComfyUI 深度联动 / 双版本）→ 快速开始（下载或开网页 → 填 Key → 3 分钟开首场会诊）→ 安全与合规声明（数据零上报、代码可审计、浏览器版与本地版的 Key 安全差异）→ 许可证（Apache-2.0）。

## 十三、许可证与合规

- 本项目选定 **Apache-2.0**［定版裁定］：含明确专利授权与专利反诉终止条款；要求保留版权与显著修改声明；不授予商标使用权（Take 名称与视觉资产受保护，防套壳冒名）。对比 MIT：缺专利保护，故不选。
- Grix 合规［已核实］：Grix 为 Source-Available 1.0、禁一切商业使用与 SaaS；本项目 Clean-room 独立实现，零代码接触、零商标使用，与 Grix 无衍生关系，无需其授权。

## 十四、MVP 分期（整理合并版）

- **Phase 1（约 1 周［未核实估算］）**：Monorepo 骨架＋群聊引擎；本地版 Tauri 骨架（macOS/Windows）＋Key 入系统凭据库；浏览器版纯前端骨架（GitHub Pages）；接入 DeepSeek、Claude、GPT/Gemini 中 3 个 API；跑通单聊/@/广播与防死循环、近 10 条截断；提示词会诊室先行。
- **Phase 2（约 1~1.5 周［未核实估算］）**：本地 CLI 双类适配（ACP＋PTY）；ComfyUI 工具挂载、报错会诊室跑通；分镜会诊室；本地用量账本与警戒线提醒；浏览器版与本地版功能对齐（本地类功能除外）。
- **Phase 3（约 1 周［未核实估算］）**：GitHub Actions 全平台打包与 Releases；文档、Issue 模板、贡献指南；正式对外宣传。

## 十五、验收清单

- [ ] 零中心依赖：断开除厂商 API 与本地环回外的一切出站，功能正常；抓包无第三方上报。
- [ ] 凭据安全：退出后查盘，本地无明文 Key（本地版）；浏览器版有明确的安全等级提示。
- [ ] 混编群聊：同一群内 API Agent 与本地 CLI Agent 可同时被 @ 或广播唤醒，流式气泡正常。
- [ ] 防死循环：诱导 Agent 互问时，系统物理切断连环触发，每 Agent 单轮至多一答。
- [ ] 上下文截断：第 20 轮时抓请求体确认只带近 10 条＋摘要。
- [ ] 开箱即用：纯净测试机双击安装包可运行（本地版）；浏览器版开网页即用，均无需预装 Node/Python。
- [ ] 用量账本：账本数字与厂商账单抽查对得上（量级一致）；警戒线提醒与锁定确认生效。
- [ ] 合规：仓库 Apache-2.0；代码与文档无 Grix 源码与标识。

## 附：效力与存档

- 本合并版由 Sunny 整理自上述 Crosswalk 定版材料，整理时只做合并、去重与两处已裁定口径的落实（CLI 双类适配、网络白名单口径），未新增功能承诺；分期顺序为整理合并版，执行前可再议。
- UI 样张 v1 与本文同批存档于 Take 目标文件夹；后续落仓时本文将作为 docs 初始文件之一进入 glider9999/take。
- 定位补充（2026-11-03 用户定）：产品为通用多 Agent 群聊客户端、面向所有 AI 用户；AI 影像是发起场景与首发预设包，take.hk 是分享/引流渠道；自定义 Agent 与房间为一等功能。房内归档帖见 #（定版补充二）。
