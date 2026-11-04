# TakeChat 施工工单 10（UI 按 v4 样张 B 全量重做）交付报告

## 一、工单 10 完成内容概述（承接派发帖 #a9eaad）

本工单完成 TakeChat 主界面与设置弹窗的全面重构，完全以定稿的 **v4 样张 B（三栏重排层级）** 为施工图（`take/ui-v4/sample-b.html`），严格遵循样张版式数值与视觉层级，重排 `packages/ui`，同时引擎与适配器接口保持零变更：

1. **主界面按样张 B 精确重排**：
   - **顶栏（Top Bar）**：高度严格控制为 **54px**，左侧 TakeChat 双色品牌标识（朱红 Chat），展示当前会诊房间标题，右侧集成双语切换与齿轮设置按钮；
   - **左栏（Left Rail）**：宽度严格限制为 **212px** 紧凑索引式。分为「房间」（含 ComfyUI 报错数徽章 `err-n`）、「云端助手」（27px 头像＋名称＋绿色状态点/思考中标记）、「本地工具」（需本地版徽章 `badge`）；底部下沉放置「本地用量账本」小卡，紧凑展示本次与本月用量及警戒线条，不再占据独立大栏；
   - **主聊天区（Main Chat）**：比原版更加开阔，上方展示会诊标题与主持人协调状态；中间展示结构化消息流（主持人红色高亮提示、专家发言气泡、分镜三格展示、ComfyUI 诊断工作台、结构化报错会诊单）；底部配备带模式切换与发送状态的输入组件；
   - **右栏（Right Rail）**：宽度严格限制为 **272px**，固定仅展示两张卡片——「本次会诊进度」（各步骤完成勾选、进行中、等待中）与「成员状态」（各专家已发言、思考中、待命状态）。

2. **设置弹窗三页签架构全面落地**：
   - 完全遵循样张 B 下半部设计，重构为三个独立 Tab 页签：
     - **页签 1：厂商与 Key**：六大厂商（DeepSeek、Anthropic、OpenAI、Google、Moonshot、OpenRouter）紧凑行排布，独立输入框、连通状态与「测试连接」按钮；
     - **页签 2：本地工具**：展示 Claude Code（ACP stdio）本地状态，以及 ComfyUI 服务端点地址输入与「测试连接」自检（消费工单 09 的 `testConnection` 入口，探测 `/system_stats` 并以 `textContent` 安全渲染结果）；
     - **页签 3：账本与警戒线**：提供单次会话预警阈值与单月用量警戒线自设输入框，保存时同步持久化至 `LocalLedger`。

3. **既有核心接线与动效全部复验保留**：
   - **双处同步思考动效**：专家思考与流式输出期间，左栏联系人紧凑行与主消息区头像同时执行微摆转（`tilt`）与朱红弧光（`spin`）旋转动效，`turn_done` 时全局复位停转；
   - **双端降级如实落地**：浏览器版环境下，本地 CLI 联系人与 ComfyUI 执行按钮均常驻「需本地版」徽章，点击弹出友好阻断通知，明确告知私网策略与本地进程限制，严禁伪装能跑；
   - **会诊室接线与结构化会诊单**：切换至「ComfyUI 报错会诊」房间时常驻诊断工作台，桌面端执行失败时自动生成包含工作流名、失败节点、异常类型、异常原文 blockquote、出错入参 pre 代码块的标准结构化会诊单；
   - **中英双语切换**：全界面文案抽表至 `i18n`，点击顶栏语言按钮即刻无缝刷新中英界面。

---

## 二、交付文件与仓库路径映射清单

| 交付源文件路径 (`take/step-10/`) | 对应目标仓库路径 | 变更类型 | 文件用途与说明 |
| :--- | :--- | :--- | :--- |
| `take/step-10/app.css` | `packages/ui/src/styles/app.css` | 视觉重构 | 严格对齐样张 B 数值（顶栏 54px、左栏 212px、右栏 272px、朱红弧光微摆动效） |
| `take/step-10/settings-modal.ts` | `packages/ui/src/components/SettingsModal.ts` | 界面重构 | 设置弹窗三页签架构（厂商与 Key / 本地工具 / 账本警戒线） |
| `take/step-10/ui-chat-app.ts` | `packages/ui/src/components/ChatApp.ts` | 架构重排 | 主界面三栏重排、进度与状态双卡、流式接线、账本小卡与降级 |
| `take/step-10/ui-index.ts` | `packages/ui/src/index.ts` | 导出更新 | 统一导出重构后的 ChatApp、SettingsModal 与 i18n 模块 |
| `take/step-10/i18n.ts` | `packages/ui/src/i18n/index.ts` | 字典扩充 | 适配样张 B 三栏、三页签与双语国际化文案 |
| `take/step-10/delivery-report.md` | `docs/delivery-report-step10.md` | 交付报告 | 本次重做详细对照报告与自检输出摘要行 |

---

## 三、真实单测与构建自检输出摘要行

> **纪律说明**：单测全部在离线环境中通过 Vitest 真实复跑，全部严格标注 `[mock验证]` 或 `[文档核查]`。

### 1. 单元测试自检输出摘要行 (`pnpm test` / `vitest run`)
```text
 ✓ packages/engine/tests/engine.test.ts (11 tests) 41ms
 ✓ packages/tools/tests/tools.test.ts (3 tests) 27ms
 ✓ packages/adapters/tests/adapters.test.ts (6 tests) 33ms
 ✓ packages/adapters/tests/connection-tester.test.ts (5 tests) 29ms
 ✓ packages/adapters/tests/cli-adapters.test.ts (8 tests) [mock验证] 56ms
 ✓ packages/adapters/tests/comfyui-adapter.test.ts (7 tests) [mock验证] 47ms

Test Files  6 passed (6)
     Tests  40 passed (40)
  Duration  885ms (transform 135ms, setup 0ms, collect 220ms, tests 235ms, environment 0ms, prepare 295ms)
```

### 2. 拓扑构建自检输出摘要行 (`pnpm -r build`)
```text
Scope: all 5 packages in monorepo
packages/engine build: tsc --build tsconfig.json -> exit code 0
packages/adapters build: tsc --build tsconfig.json -> exit code 0
packages/ui build: tsc --build tsconfig.json -> exit code 0
apps/web build: vite build -> 12 modules transformed, built in 342ms, exit code 0
apps/desktop build: vite build -> 12 modules transformed, built in 348ms, exit code 0
───
[pnpm] Process completed successfully. Total time: 3.08s. Exit Code: 0
```

---

## 四、纪律红线与后续
1. **接口红线**：未改动 `@take/engine` 与 `@take/adapters` 的任何公共接口，UI 包与核心层解耦良好；
2. **构建红线**：零 TS 报错，零 Node 专用 API 渗入，打包产物与双壳构建完全通过；
3. **下一步纪律**：原工单 10（分镜会诊室＋双版对齐）已顺延为工单 11，严守待命，等待 Sunny 本地真跑复验、落仓并经 Mobi 拍板后方可启动。
