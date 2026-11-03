# Take 施工工单 04（双外壳＋UI 接线＋工单 03 修正单）交付报告

> 对应工单：#rv0ya1（双外壳＋v3 动效 UI 接线＋工单 03 验收修正单）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-04/` ＋ `take/step-03/engine.test.ts` (v2)

---

## 一、工单 03 修正单落实说明（Vitest 6/6 全绿）

- **根因修复**：原 `engine.test.ts` 中的用例 f) 未经 `engine.initTurn` 门面开启合法轮次，导致调度器执行纪律拦截（`currentTurn = 0, got 1`）。
- **修正实现**：在测试用例 f) 中先构造合法用户消息触发 `engine.initTurn(sampleSession, userMsg, 'mention')` 正式进入轮次 1，再依次断言 `typing` -> `chunk` -> `agent_done` (触发 `usage`) -> `turn_done` 完整事件流。
- **验证结果**：用例 6/6 全部通过（四项必测 a/b/c/d ＋ 互见上下文 e ＋ 生命周期事件序 f），零报错零警告。更新后文件已覆盖归档至 `take/step-03/engine.test.ts` v2（SHA-256: 6c4104c6...）。

---

## 二、双外壳与 UI 接线交付文件映射表

| step-04 存放文件名 | 对应仓库路径 (`glider9999/take`) | 核心属性与规格说明 |
| :--- | :--- | :--- |
| `web-package.json` | `apps/web/package.json` | 浏览器轻装版工程：依赖 `@take/engine: workspace:*` |
| `web-vite.config.ts` | `apps/web/vite.config.ts` | Vite 配置：配置 `base: './'` 满足 GitHub Pages 纯静态部署 |
| `web-index.html` | `apps/web/index.html` | 浏览器轻装版 HTML 容器，挂载 `TakeChat · 多智能体协作群聊` |
| `desktop-package.json` | `apps/desktop/package.json` | 桌面完全版工程：集成 Tauri v2 API 与 Shell 插件 |
| `desktop-vite.config.ts` | `apps/desktop/vite.config.ts` | 桌面端 Vite 端口固定（5173）与构建配置 |
| `desktop-index.html` | `apps/desktop/index.html` | 桌面端 HTML 容器，挂载客户端原生窗口 |
| `tauri.conf.json` | `apps/desktop/src-tauri/tauri.conf.json` | **productName 正式修改为 `TakeChat`**，identifier 保持 `im.take.client` |
| `app.css` | `apps/web/src/styles/app.css` | **v3 样张样式与动效全量实现**（包含朱红弧光与摆转 keyframes） |
| `chat-app.ts` | `apps/web/src/components/ChatApp.ts` | **TakeChat 核心交互组件**：对齐 v3 样张，接通 `@take/engine` 演示流 |
| `web-main.ts` | `apps/web/src/main.ts` | Web 端启动入口：挂载 ChatApp（`isDesktop: false`） |
| `desktop-main.ts` | `apps/desktop/src/main.ts` | 桌面端启动入口：挂载 ChatApp（`isDesktop: true`） |
| `delivery-report.md` | `docs/delivery-report-step04.md` | 本交付报告全文与验收指南 |

---

## 三、UI 样张 v3 像素级对齐与动效系统落实

严格遵循 `take/chat-ui-mockup-client-v3.html` 施工图规范：
1. **版式、配色与品牌**：
   - 品牌全案统一为 **`TakeChat`**；
   - 窗口容器背景 `#FAF7F0`、底色 `#EFE9DD`、顶栏 Chrome `#F3EFE6`、核心强调色朱红 `#C8402A`、深黑文本 `#1C1A17`、字号间距 100% 对齐样张。
2. **本体与旁联动效双处同步（V3 灵魂）**：
   - **头像微摆转**：`.av.think { animation: avrock 2.4s ease-in-out infinite; }`（-6deg 至 6deg 平滑摆动）；
   - **朱红弧光环绕旋转**：`.av.think::after` 动态环绕光环（`border-top-color: #C8402A; animation: avspin 1.5s linear infinite;`）；
   - **两处严格同步**：当某 Agent（如 Claude 或 ChatGPT）处于推理或流式输出期间，**左侧联系人列表该 Agent 头像**与**右侧主聊天区该 Agent 消息头像**同时亮起 `.think` 状态，状态文字显示朱红 `.thinklbl` 并伴随 `.tdots` 脉冲呼吸；
   - **闭环熄灭**：该 Agent 回复完成（`agent_done`）或整轮结束（`turn_done`）时，动效瞬间同步平滑恢复静止态。

---

## 四、真实驱动与引擎接线说明

1. **真实 `@take/engine` 驱动**：
   - 界面不再是纯静态死 HTML，而是由 `ContextEngine` 完整掌管会话生命周期；
   - 支持实时切换「会诊模式 · 开」（全员广播）与「单聊模式 · 关」（@定向点名）；
   - 支持通过底部 `@` 按钮快速唤醒目标专家。
2. **多 Agent 协作接力演示流**：
   - 用户输入提问并点击发送后，系统通过 `initTurn` 开启轮次，调度器按序唤醒目标 Agent；
   - Claude 率先完成提示词输出后，组装器将 Claude 成果存入 `turnCompletedResponses`；
   - 紧接着 Grok Bot 与 ChatGPT 在组装上下文时动态看见 Claude 的成果，输出适配工作流与分镜草图，最后弹出主持人汇总卡片；
   - 每次生成伴随 `usage` 事件累计本地 Token 账本，顶栏实时折算更新金额。

---

## 五、Sunny 本地验收自检步骤

1. **复测工单 03 测试**：
   ```bash
   cd packages/engine
   pnpm test
   # 预期输出：6 passed (100% 全绿)
   ```
2. **本地启动 Web 轻装版**：
   ```bash
   cd apps/web
   pnpm install
   pnpm dev
   # 浏览器打开 http://localhost:3000，即可看到 TakeChat 完整界面，支持点击联系人切换动效，点击发送体验多模型会诊流
   ```
3. **构建验证**：
   ```bash
   pnpm --filter @take/web build
   # 生成纯静态 dist/ 目录，可直接丢入 GitHub Pages 零配置运行
   ```

