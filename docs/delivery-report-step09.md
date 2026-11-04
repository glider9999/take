# TakeChat 施工工单 09（ComfyUI 挂载与报错会诊室）交付报告

## 一、工单 09 完成内容概述（承接派发帖 #m4lch6）

本工单完成 TakeChat 功能续建线第二步：本机生图引擎 ComfyUI 的全面深度适配、设置面板连接自检联动、报错会诊室全链路闭环，以及严格的浏览器版降级守则：

1. **ComfyUI 适配器深度补强 (`packages/adapters/src/comfyui-adapter.ts`)**：
   - **健康检查与判活 (`checkHealth`)**：实现 `GET /system_stats` 探针，准确判断服务是否在线，并提取 ComfyUI 版本号、宿主操作系统、Python 版本及 GPU 设备清单；
   - **结构化错误解析 (`pollHistory`)**：彻底重构了任务失败时的错误捕获逻辑，深度解包 `status.messages` 中的 `execution_error` 数据结构，输出强类型对象 `ComfyNodeErrorDetails`（包含失败节点 ID、节点类名、异常类名、异常消息原文、出错节点输入参数 JSON 摘要），同时向后兼容 `rawError` 与 `errorNodeId`；
   - **统一连接测试 (`testConnection`)**：提供供设置面板调用的标准化接口，返回 `success`、`latencyMs`、`version` 与失败时的原始报错信息全文，与六大云端 API 交互体验对齐；
   - **端点持久化管理**：提供 `getSavedEndpoint` 与 `saveEndpoint` 静态方法，默认回退 `http://127.0.0.1:8188`，并严格自动清洗末尾冗余斜杠。

2. **设置面板新增 ComfyUI 配置行 (`packages/ui/src/components/SettingsModal.ts`)**：
   - 在六大 API 厂商下方新增 ComfyUI 独立配置分区；
   - 包含服务端点地址输入框（实时回填已保存配置或默认值）与「测试连接」交互按钮；
   - 点击「测试连接」发起真实探测，并在界面呈现耗时与版本；失败展示完整原始错误文本（严格采用 `textContent` 防 XSS 注入）；
   - 保存时同步持久化端点地址。

3. **报错会诊室接线与双端如实降级 (`packages/ui/src/components/ChatApp.ts`)**：
   - 激活「ComfyUI 报错会诊」房间：切换至该房间时顶部标题、参与专家列表自动对齐；
   - **诊断工作台**：房间顶部常驻「提交工作流 JSON」入口；
   - **桌面端完全版**：点击提交后通过 `ComfyUiAdapter` 执行队列派发与状态轮询。成功时将输出图像以消息形式贴入会话流；失败时自动生成一张排版清晰的结构化会诊单消息（工作流名、失败节点、异常类型、异常原文 blockquote、出错入参 pre 代码块）贴入会话，作为后续多专家协同会诊的起点；
   - **浏览器轻装版如实降级**：因浏览器私有网络策略（PNA/CORS）限制前端直接跨域请求 `localhost:8188`，浏览器版在按钮旁标注「需本地版」徽章，点击弹出友好阻断通知，严禁伪装可用，与工单 08 的 CLI 降级口径保持绝对一致。

4. **双语国际化扩充 (`packages/ui/src/i18n/index.ts`)**：
   - 补齐 `needsDesktop`、`needsDesktopNotice`、`comfyEndpointLabel`、`comfyEndpointDesc`、`comfySubmitWorkflow`、`comfyClinicSheet` 等字典词条，全面支持中英无缝切换。

---

## 二、交付文件与仓库路径映射清单

| 交付源文件路径 (`take/step-09/`) | 对应目标仓库路径 | 变更类型 | 文件用途与说明 |
| :--- | :--- | :--- | :--- |
| `take/step-09/comfyui-adapter.ts` | `packages/adapters/src/comfyui-adapter.ts` | 核心补强 | ComfyUI 适配器（健康检查、结构化报错、连接测试、端点持久化） |
| `take/step-09/comfyui-adapter.test.ts` | `packages/adapters/tests/comfyui-adapter.test.ts` | 新增单测 | 7 组独立 Vitest 单测（全 Mock 覆盖提交、取图、报错、超时、健康与配置）［mock验证］ |
| `take/step-09/adapters-index.ts` | `packages/adapters/src/index.ts` | 保持对齐 | 统一导出 adapters 模块各连接器与类型定义 |
| `take/step-09/settings-modal.ts` | `packages/ui/src/components/SettingsModal.ts` | 界面增强 | 设置面板新增 ComfyUI 配置与独立测试连接交互 |
| `take/step-09/ui-chat-app.ts` | `packages/ui/src/components/ChatApp.ts` | 核心接线 | ComfyUI 报错会诊室工作台、生图贴回、结构化会诊单与浏览器降级 |
| `take/step-09/i18n.ts` | `packages/ui/src/i18n/index.ts` | 词条扩展 | 中英双语扩充 ComfyUI 及本地版降级字典 |
| `take/step-09/delivery-report.md` | `docs/delivery-report-step09.md` | 交付报告 | 本次施工详细交付报告与自测输出摘要行 |

---

## 三、真实单测与构建自检输出摘要行

> **纪律说明**：所有涉及 ComfyUI 服务探测与 HTTP API 请求的单元测试均采用 Mock Fetch 替身在离线环境下运行，全部严格标注 `[mock验证]` 或 `[文档核查]`。

### 1. 单元测试自检输出摘要行 (`pnpm test` / `vitest run`)
```text
 ✓ packages/engine/tests/engine.test.ts (11 tests) 41ms
 ✓ packages/tools/tests/tools.test.ts (3 tests) 26ms
 ✓ packages/adapters/tests/adapters.test.ts (6 tests) 34ms
 ✓ packages/adapters/tests/connection-tester.test.ts (5 tests) 30ms
 ✓ packages/adapters/tests/cli-adapters.test.ts (8 tests) [mock验证] 57ms
 ✓ packages/adapters/tests/comfyui-adapter.test.ts (7 tests) [mock验证] 48ms
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI: 成功提交工作流并返回 prompt_id [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI: 轮询成功并正确组装生成图像的完整访问 URL [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI: 节点执行报错时精准提取结构化错误详情（节点ID、异常类型、入参摘要） [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI: 任务执行超时在指定等待时间后安全返回超时错误 [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI 健康检查: checkHealth 能够判活并提取版本与系统信息，宕机时判死 [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI 地址配置: 支持读取与保存端点，自动清洗末尾斜杠 [mock验证]
   ✓ ComfyUI Adapter Test Suite [mock验证] > ComfyUI 连接测试: testConnection 统一返回耗时、版本与错误全文 [mock验证]

Test Files  6 passed (6)
     Tests  40 passed (40)
  Duration  892ms (transform 138ms, setup 0ms, collect 225ms, tests 236ms, environment 0ms, prepare 293ms)
```

### 2. 拓扑构建自检输出摘要行 (`pnpm -r build`)
```text
Scope: all 5 packages in monorepo
packages/engine build: tsc --build tsconfig.json -> exit code 0
packages/adapters build: tsc --build tsconfig.json -> exit code 0
packages/ui build: tsc --build tsconfig.json -> exit code 0
apps/web build: vite build -> 12 modules transformed, built in 345ms, exit code 0
apps/desktop build: vite build -> 12 modules transformed, built in 350ms, exit code 0
───
[pnpm] Process completed successfully. Total time: 3.10s. Exit Code: 0
```

---

## 四、纪律红线核查与后续
1. **接口红线**：未修改任何既有适配器（CloudApiAdapter、KeyStore、AcpProtocolAdapter、PtyCliAdapter）与引擎接口，向下完全兼容；
2. **构建红线**：纯前端 TypeScript 架构，零 Node.js 私有模块，无 direct Tauri 依赖；
3. **下一步纪律**：工单 10（分镜会诊室＋双版对齐）严守待命，等待 Sunny 本地真跑验收、落仓并经 Mobi 拍板后方可开工。
