# Take 施工工单 05（适配器与 UI 共享包 · 缺陷修复与定版报告）

> 对应工单：#zh73tw（六大厂商 API 适配器＋Key 统一存储＋ACP 与 ComfyUI 适配器＋UI 共享包抽离）  
> 验收回执修复：#m5wyy3（Sunny 本地真跑实测反馈的三处实证缺陷专项修复）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-05/`  
> 测试纪律：所有联调测试均基于 Mock Fetch 离线执行，结论统一标注［mock验证］

---

## 一、三处实证缺陷专项修复落实报告

### 1. 缺陷 1 修复：应用依赖补齐、样式死链清理与 exports 映射
- **依赖声明补齐**：`apps/web/package.json` 与 `apps/desktop/package.json` 的 `dependencies` 均补齐了 `@take/ui: workspace:*` 与 `@take/adapters: workspace:*`，彻底解决 Rollup 报 `Failed to resolve import "@take/ui"` 的构建失败问题。
- **HTML 死链清理**：`apps/web/index.html` 与 `apps/desktop/index.html` 彻底删除了已失效的 `<link rel="stylesheet" href="./src/styles/app.css" />` 死链，全局样式由 `main.ts` 中的 `import '@take/ui/styles/app.css'` 统一打包载入。
- **UI 包导出映射**：`packages/ui/package.json` 正式添加 `exports` 字段：
  ```json
  "exports": {
    ".": "./dist/index.js",
    "./styles/app.css": "./src/styles/app.css"
  }
  ```
  使外部工程按标准模块路径引入样式完全畅通。

### 2. 缺陷 2 修复：SSE 跨网络分片行缓冲区（彻底解决丢字）
- **根因消除**：原解析器直接对每个数据块 `split('\n')`，导致跨分片被截断的未闭合 JSON 在 `JSON.parse` 失败后被吞掉。
- **机制重构**：在 `parseOpenAiSse` 与 `parseAnthropicSse` 中增加跨分片行缓冲区 `buffer`。每次 `read()` 解码后拼入 `buffer`，弹出未换行的末尾字符串（`buffer = lines.pop() || ''`）暂存；仅对拥有完整换行符的行进行 JSON 解析。流结束时再将残余内容按完整行消化。
- **复测验证**：单测用例 2 特意模拟将 `{"choices":[{"delta":{"conte` 与 `nt":"思考完成。"}}` 横跨在两个网络数据包中，实测确认完整拼接出『深度思考完成。』，丢字缺陷彻底消除。

### 3. 缺陷 3 修复：429 错误单点精准分发（杜绝二次覆盖）
- **根因消除**：原代码在 `handleResponseStatus` 报了一次 `onError` 并抛错，外层 catch 又无参调了一次 `onError`，导致 429 标志位被冲掉且双报。
- **机制重构**：
  - 定义类型化异常 `RateLimitError(retryAfterSeconds)`；
  - `handleResponseStatus` 内部**只抛出类型化错误，绝对不调用 `callbacks.onError`**；
  - 外层 `streamChat` 的 catch 块进行统一模式匹配，当捕获到 `RateLimitError` 时单次精准调用 `callbacks.onError(err, true, err.retryAfterSeconds)`。
- **复测验证**：单测用例 3 断言 `onError` 仅触发 1 次，且 `isRateLimit === true`、`retryAfterSeconds === 6` 完整保留。

---

## 二、交付文件与目标仓库路径完整映射表

| step-05 存放文件名 | 对应仓库路径 (`glider9999/take`) | 核心功能与架构职责 |
| :--- | :--- | :--- |
| `ui-package.json` (v2) | `packages/ui/package.json` | 增加 `./styles/app.css` exports 导出映射 |
| `web-package.json` (v2) | `apps/web/package.json` | 补齐 `@take/ui` 与 `@take/adapters` 依赖 |
| `desktop-package.json` (v2) | `apps/desktop/package.json` | 补齐 `@take/ui` 与 `@take/adapters` 依赖 |
| `web-index.html` (v2) | `apps/web/index.html` | 彻底移除样式死链 |
| `desktop-index.html` (v2) | `apps/desktop/index.html` | 彻底移除样式死链 |
| `cloud-api-adapter.ts` (v2) | `packages/adapters/src/cloud-api-adapter.ts` | **核心修复**：SSE 跨片行缓冲（不丢字）＋ 429 错误单点精准分发 |
| `adapters.test.ts` (v2) | `packages/adapters/tests/adapters.test.ts` | **Vitest 单测**：6 组测试（含跨片断行拼接、429 单报断言）［mock验证］ |
| `ui-tsconfig.json` | `packages/ui/tsconfig.json` | 纯前端严格编译配置 |
| `ui-app.css` | `packages/ui/src/styles/app.css` | 单一权威样式源：样张 v3 样式与动效 keyframes |
| `ui-chat-app.ts` | `packages/ui/src/components/ChatApp.ts` | 单一权威组件源：TakeChat 交互组件 |
| `ui-index.ts` | `packages/ui/src/index.ts` | 统一导出 UI 组件 |
| `web-main.ts` | `apps/web/src/main.ts` | 浏览器端从 `@take/ui` 引入 |
| `desktop-main.ts` | `apps/desktop/src/main.ts` | 桌面端从 `@take/ui` 引入 |
| `ci.yml` | `.github/workflows/ci.yml` | 拓扑构建顺序（先 build engine/ui，再 build 壳） |
| `adapters-package.json` | `packages/adapters/package.json` | 适配器包定义 |
| `adapters-tsconfig.json` | `packages/adapters/tsconfig.json` | 适配器编译配置 |
| `http-client.ts` | `packages/adapters/src/http-client.ts` | HTTP 双环境抽象（单一 fetch 网关，零 Tauri 依赖） |
| `keystore.ts` | `packages/adapters/src/keystore.ts` | Key 统一存储接口（浏览器本地 vs 桌面钥匙串注入） |
| `acp-cli-adapter.ts` | `packages/adapters/src/acp-cli-adapter.ts` | 桌面 ACP 适配器（白名单拦截，protocolVersion 整数 1） |
| `comfyui-adapter.ts` | `packages/adapters/src/comfyui-adapter.ts` | ComfyUI 适配器（提交/轮询/取图/节点报错原文回传） |
| `adapters-index.ts` | `packages/adapters/src/index.ts` | 统一导出连接层 API |
| `delivery-report.md` | `docs/delivery-report-step05.md` | 本交付与验收指南报告 |

---

## 三、Vitest 6 组单测复核说明［mock验证］

测试文件 `packages/adapters/tests/adapters.test.ts` 严格核实包含 6 组测试，全部基于 Mock Fetch 离线运行：
1. **Anthropic opt-in 头与流式解析［mock验证］**：断言请求头必含 `anthropic-dangerous-direct-browser-access: true`，提取 usage。
2. **OpenAI 兼容层跨网络分片断行拼接［mock验证］**：断言未闭合跨片 JSON 行在缓冲区内自动拼接，完整收到『深度思考完成。』，不丢字。
3. **429 速率限制拦截与退避单点透传［mock验证］**：断言单次捕获并精准透传 `isRateLimit: true` 与 `retryAfterSeconds: 6`，不被二次覆盖。
4. **用户主动终止生成（AbortController）［mock验证］**：断言调用 `abort()` 优雅中断连接并捕获终止错误。
5. **ComfyUI 适配器提交与节点报错回传［mock验证］**：断言在节点执行失败时原样提取返回报错信息。
6. **KeyStore 双语义与数据隔离［mock验证］**：断言浏览器本地存储与桌面钥匙串命令调用双轨独立运转。

---

## 四、本地复验命令指引

Sunny 在本地执行以下步骤复验落仓：
```bash
# 1. 适配器单元测试复跑
cd packages/adapters
pnpm test
# 预期输出：6 passed (100% 全绿)

# 2. 引擎单元测试复跑
cd ../engine
pnpm test
# 预期输出：6 passed (100% 全绿)

# 3. Monorepo 拓扑全量构建
cd ../..
pnpm -r build
# 预期输出：engine -> ui -> adapters -> web -> desktop 全量构建通过，零 Rollup 解析与死链报错
```

