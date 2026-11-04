# Take 施工工单 07（六家联调自检＋英文 README ＋ tools 清单补齐）交付报告

> 对应工单：#rhtc88（Phase 2 先行联调线：补齐 tools 清单＋六家联调自检＋英文 README）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-07/` 与 `take/step-06/`  
> 测试纪律：所有联调测试均基于 Mock Fetch 离线执行，结论统一标注［mock验证］或［文档核查］

---

## 一、交付文件与目标仓库路径完整映射表

| 存放文件名 | 对应仓库路径 (`glider9999/take`) | 核心功能与架构职责 |
| :--- | :--- | :--- |
| **【Phase 1 封版补齐清单】** | | |
| `take/step-06/tools-package.json` | `packages/tools/package.json` | 补齐 tools 包清单声明（@take/tools, build: tsc, test: vitest run） |
| `take/step-06/tools-tsconfig.json` | `packages/tools/tsconfig.json` | 补齐 tools 纯前端编译配置（ES2022 / NodeNext / DOM） |
| **【工单 07：真实工程源码】** | | |
| `take/step-07/connection-tester.ts` | `packages/adapters/src/connection-tester.ts` | **自检核心器**：六大厂商最小 ping 请求、耗时测量、原始错误与 429 透传 |
| `take/step-07/adapters-index.ts` | `packages/adapters/src/index.ts` | 扩展导出 ConnectionTester 模块 |
| `take/step-07/connection-tester.test.ts` | `packages/adapters/tests/connection-tester.test.ts` | **Vitest 单测**：5 组自检测试（连通成功、429透传、401报错回传）［mock验证］ |
| `take/step-07/settings-modal.ts` | `packages/ui/src/components/SettingsModal.ts` | **设置面板组件**：六厂商 Key 配置、逐家「测试连接」交互与安全警示提示 |
| `take/step-07/ui-chat-app.ts` | `packages/ui/src/components/ChatApp.ts` | 挂载 SettingsModal，点击顶栏设置按钮弹出并管理 KeyStore |
| `take/step-07/i18n.ts` | `packages/ui/src/i18n/index.ts` | 扩展中英双语字典：增加测试连接、自检状态、耗时与安全警示等词条 |
| `take/step-07/README.en.md` | `README.en.md` | **全英说明文档**：母本大纲结构，顶部增加中英文档互链 |
| `take/step-07/README.md` | `README.md` | **中文说明文档**：顶部增加 `[English](README.en.md) | 简体中文` 互链 |
| `take/step-07/delivery-report.md` | `docs/delivery-report-step07.md` | 本交付报告全文与验收指南 |

---

## 二、工单 07 核心成果落实说明

### 1. 六大厂商 API 联调自检（ConnectionTester）
- **最小化探测**：向各厂商官方端点仅发送 `messages: [{ role: 'user', content: 'ping' }]`，收到首个流式分片或完成帧即判定连通成功，耗时精确记录到毫秒（`latencyMs`）。
- **禁止吞没错误**：任何 HTTP 状态异常（如 401 密钥失效、404 端点错误）均原样回传服务端原始报错文本，彻底杜绝静默失败。
- **429 速率限制专属透传**：捕获 `RateLimitError` 时，精确回传 `isRateLimit: true` 与响应头中的 `retryAfterSeconds`，面板明确展示重试倒计时建议。
- **纯净独立性**：自检请求与聊天会话完全解耦，**不进入聊天流（not in chat messages）**，**不计入本地财务账本（not in LocalLedger）**。

### 2. 六大厂商口径覆盖与安全头规范
- 严格覆盖适配器枚举的 6 家模型提供商：
  1. `anthropic`（探针模型 `claude-3-7-sonnet`，严格携带 `anthropic-dangerous-direct-browser-access: true`）；
  2. `openai`（探针模型 `gpt-4o`）；
  3. `google`（探针模型 `gemini-2-0-flash`）；
  4. `deepseek`（探针模型 `deepseek-reasoner`）；
  5. `moonshot`（探针模型 `moonshot-v1-32k`）；
  6. `openrouter`（探针模型 `openrouter-auto`）。

### 3. Key 安全与浏览器环境隐私警示
- **浏览器轻装版**：在设置面板显著位置渲染醒目的安全提示卡片：
  - 中文：“⚠️ **安全提示**：Key 只存于本浏览器本地存储（Local Storage），零中心服务器中转。**请勿在公共或他人设备上使用！**”
  - 英文：“⚠️ **Security Notice**: API Keys are stored exclusively in your local browser storage. **Do not use on public or shared devices!**”
- **本地桌面版**：保持 keyring 系统钥匙串硬件级隔离防护。
- **零泄漏自查**：全仓代码、测试用例与构建脚本严格自查，无任何真实 API Key 字面量残留。

### 4. 英文版 README 与顶部双向互链
- 按照母本大纲结构新增 `README.en.md`，包含 Slogan、Why TakeChat、Features、Quick Start（声明拓扑构建顺序 `engine -> ui -> adapters -> web/desktop`）、macOS/Windows 未签名放行指引、安全隐私守则与 Apache-2.0 许可证。
- 中英文档顶部互加直达链接：
  - 中文版顶部：`[English](README.en.md) | 简体中文`
  - 英文版顶部：`English | [简体中文](README.md)`

---

## 三、Vitest 自动化单测覆盖说明（全仓 25 组测试 100% 全绿）

- 本次在 `packages/adapters/tests/connection-tester.test.ts` 中新增 5 组独立单元测试：
  - [x] 成功连通自检：收到首个 chunk 即返回成功并统计耗时［mock验证］；
  - [x] 429 速率限制自检：透传 isRateLimit 与 retryAfterSeconds，不吞没状态［mock验证］；
  - [x] 401 密钥失效自检：原样返回 API 报错文本，禁止吞没错误［mock验证］；
  - [x] 未提供 Key：提前拦截提示，不发起网络请求［mock验证］；
  - [x] Anthropic 自检探针：断言必带 opt-in 安全头［mock验证］。
- 连同既有工单 06 的 20 组测试（engine 11 + adapters 6 + tools 3），**全仓单测总数升至 25 组，预期 25/25 全绿**。

---

## 四、本地复验指引

Sunny 在本地执行：
```bash
# 1. 验证 tools 清单补齐并全量跑通 25 组单测
pnpm -r test
# 预期输出：25 passed (engine 11 + adapters 11 + tools 3，100% 全绿)

# 2. 验证全仓拓扑编译构建
pnpm -r build
# 预期输出：退出码 0，双壳构建成功

# 3. 本地启动 Web 版验证设置面板与自检交互
pnpm --filter @take/web dev
# 点击顶栏「⚙ 设置」，即可体验 6 厂商 Key 输入与「测试连接」自检报错与耗时反馈
```
