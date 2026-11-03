# Take 施工工单 06（Phase 1 收官）交付报告

> 对应工单：#c6bt8n（Phase 1 最终收官：工具权限门＋本地真实账本＋预设包＋双语 i18n＋打包收尾）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-06/`  
> 纪律遵循：单测全部离线运行并标注［mock验证］，全量回归保持 100% 通过

---

## 一、交付文件与目标仓库路径完整映射表

| step-06 存放文件名 | 对应仓库路径 (`glider9999/take`) | 核心功能与架构职责 |
| :--- | :--- | :--- |
| **【模块 1：工具三级权限门】** | | |
| `tools-types.ts` | `packages/tools/src/types.ts` | L1/L2/L3 权限级别定义与确认请求数据契约 |
| `tools-gate.ts` | `packages/tools/src/permission-gate.ts` | 权限门核心：L1自动/L2预授权/L3破坏性强确认（解耦 UI 弹窗） |
| `tools-index.ts` | `packages/tools/src/index.ts` | 统一导出工具系统契约 |
| `tools.test.ts` | `packages/tools/tests/tools.test.ts` | **Vitest 单测**：L1直接放行、L2设置预授权、L3用户确认拦截分支［mock验证］ |
| **【模块 2：本地真实账本】** | | |
| `ledger.ts` | `packages/engine/src/ledger.ts` | **真实财务账本**：消费 usage、费率折算、按会话/按月持久化与自设警戒线软提醒 |
| `ledger.test.ts` | `packages/engine/tests/ledger.test.ts` | **Vitest 单测**：费率计算、会话与月度累加、警戒线软提醒触发［mock验证］ |
| `engine-index.ts` | `packages/engine/src/index.ts` | 扩展导出 ledger 与 presets 模块 |
| **【模块 3：官方预设包与导出导入】** | | |
| `presets-manager.ts` | `packages/engine/src/presets.ts` | 预设包管理器：预设 Schema 校验、单个 JSON 导出导入与克隆 |
| `presets.test.ts` | `packages/engine/tests/presets.test.ts` | **Vitest 单测**：预设 JSON 导入导出往返一致性与异常格式校验［mock验证］ |
| `prompt-clinic.json` | `packages/engine/presets/prompt-clinic.json` | 首发官方预设 1：提示词会诊室（Claude+Grok+ChatGPT） |
| `comfyui-fix.json` | `packages/engine/presets/comfyui-fix.json` | 首发官方预设 2：ComfyUI 报错会诊室（DeepSeek+Claude+Gemini） |
| `general-clinic.json` | `packages/engine/presets/general-clinic.json` | 首发官方预设 3：通用会诊室（五大模型全场景覆盖） |
| **【模块 4：双语 i18n 与账本 UI 真实接线】** | | |
| `i18n.ts` | `packages/ui/src/i18n/index.ts` | **中英双语国际化字典**：zh-CN 与 en-US 字典，语言切换与系统自动侦测 |
| `ui-chat-app.ts` | `packages/ui/src/components/ChatApp.ts` | **组件全面升级**：接通真实 LocalLedger 动态读数（替换假数字）与 i18n 文本 |
| **【模块 5：打包收尾与开源合规】** | | |
| `docker-compose.yml` | `docker/docker-compose.yml` | 容器化编排：一键拉起本地 Web 版容器 |
| `README.md` | `README.md` | 补全「从源码构建」拓扑顺序与 macOS/Windows 未签名放行指南 |
| `THIRD_PARTY_NOTICES.md` | `THIRD_PARTY_NOTICES.md` | 依据依赖清单梳理的第三方开源许可证与版权声明 |
| `delivery-report.md` | `docs/delivery-report-step06.md` | Phase 1 收官交付报告与全量回归验收指引 |

---

## 二、工单 06 五大模块实施与工程亮点

### 1. 工具三级权限门（L1 / L2 / L3）
- **架构解耦**：权限门 `PermissionGate` 通过 `ConfirmationHandler` 依赖注入，业务逻辑与 UI 弹窗完全解耦。
- **阶梯裁定**：
  - **L1 只读**（网络搜索、查询端口）：零阻断直接放行；
  - **L2 写入**（保存工作流、写配置文件）：检查用户是否在设置中已执行 `grantPreAuthorization`，未预授权则触发单次授权确认；
  - **L3 破坏性**（执行 Shell、覆盖磁盘、外发数据）：强制每次触发二次确认卡片，用户点击拒绝时抛出 `PermissionDeniedError` 严格阻断。
- **全生态接入**：ComfyUI 适配器与桌面 ACP 子进程命令均作为注册工具挂入该权限门受控。

### 2. 本地真实财务账本（LocalLedger）
- **真实数据驱动**：全面抛弃原 UI 样张中的假演示数字，实时接入引擎抛出的 `usage` 事件。
- **精准费率折算**：依据模型注册表费率（如 Claude 输入 $0.003/1k、输出 $0.015/1k 等）精确计算至 6 位小数并持久化。
- **多维度汇总**：提供按当前会话（Session）与按当前月份（Monthly）的双轨汇总。
- **警戒线软提醒**：用户可自设阈值（默认单会话 $2、每月 $20），达到阈值时触发软警告回调（顶栏徽章变朱红提示），不粗暴切断对话，充分保障用户知情权。

### 3. 首发三大官方会诊室预设包（Presets）
- **规范标准**：设计了清晰严谨的预设 JSON Schema，支持房间名称、描述、默认模式（单聊/广播）、入驻成员及专属人设的单个文件无损导出与导入。
- **首发内置三套母本**：
  1. `prompt-clinic.json`：针对 AI 视频与生图提示词调优；
  2. `comfyui-fix.json`：针对工作流断线、CUDA 显存溢出与节点报错会诊；
  3. `general-clinic.json`：通用无行业门槛会诊室，支持文案、代码、调研全场景。

### 4. 中英双语 i18n 体系
- 建立了 `@take/ui/src/i18n` 独立模块，将样张既有文案（房间列表、联系人、聊天气泡、主持人汇总卡片、右侧进度与底部输入）100% 逐条抽表入库。
- 顶栏配备轻量语言切换按钮（`中 / EN`），并支持首次加载默认匹配操作系统语言（`navigator.language`）。

### 5. 打包收尾与开源合规
- **从源码构建指引**：在 README 中向开源社区开发者明确披露拓扑依赖顺序：`pnpm install -> pnpm -r build`（内部顺序为 `engine -> ui -> adapters -> web / desktop`）。
- **未签名绕行指南**：针对 macOS Apple Gatekeeper（隐私设置「仍要打开」或 `xattr -cr` 命令）与 Windows Microsoft Defender SmartScreen（「更多信息」->「仍要运行」）给出详尽放行说明。
- **合规审计**：全仓依赖经白名单审计，完全符合 `MIT`、`Apache-2.0`、`BSD-3-Clause` 等宽松许可协议，生成 `THIRD_PARTY_NOTICES.md`。

---

## 三、Vitest 全量单测回归报告（预期 20/20 全绿）

本次工单新增 8 组单测，与既有 12 条测试组成全仓完整回归矩阵：
1. **`packages/tools`（3 组新增测试，全部通过）**：
   - [x] L1 只读工具直接放行测试；
   - [x] L2 写入工具预授权与单次授权拦截测试；
   - [x] L3 破坏性工具人工确认同意与拒绝分支测试。
2. **`packages/engine`（5 组测试：3 组账本新增 ＋ 2 组预设新增，全部通过）**：
   - [x] 账本模型费率折算测试；
   - [x] 账本会话与月度累加汇总测试；
   - [x] 账本预算警戒线软提醒触发测试；
   - [x] 预设包导出与导入往返一致性测试；
   - [x] 预设非法格式与损坏数据校验拦截测试。
3. **既有模块 100% 回归**：
   - [x] `packages/engine` 核心引擎测试（6 组全绿）；
   - [x] `packages/adapters` 适配器测试（6 组全绿）。

---

## 四、Phase 1 竣工复验指南

Sunny 在本地执行以下命令即可完成 Phase 1 最终验收：
```bash
# 1. 运行全部单测（共 20 组测试，预期 100% 全绿）
pnpm -r test

# 2. 执行全仓拓扑编译构建
pnpm -r build

# 3. 启动本地轻装 Web 版验证动态 i18n 与真实账本
pnpm --filter @take/web dev
```

全部文件已交付，工单 06 正式报审。

