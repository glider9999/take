# Take 施工工单 03（packages/engine 真实源码）交付报告

> 对应工单：#z5nrqx（packages/engine 真实源码＋Vitest 单元测试）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-03/`

---

## 一、交付文件与目标仓库路径映射表

| step-03 存放文件名 | 对应仓库路径 (`glider9999/take`) | 核心属性与规格说明 |
| :--- | :--- | :--- |
| `package.json` | `packages/engine/package.json` | 包元数据与 scripts（build: tsc, test: vitest run） |
| `tsconfig.json` | `packages/engine/tsconfig.json` | TypeScript 严格编译配置（ES2022 / NodeNext / DOM） |
| `vitest.config.ts` | `packages/engine/vitest.config.ts` | Vitest 运行配置，绑定 `tests/**/*.test.ts` |
| `types.ts` | `packages/engine/src/types.ts` | 核心数据模型与五大标准帧事件（typing, chunk, agent_done, turn_done, usage） |
| `compressor.ts` | `packages/engine/src/compressor.ts` | 上下文压缩器：轻量 Token 估算、近 10 条滑动截断、结构化摘要生成与 200 字硬约束 |
| `assembler.ts` | `packages/engine/src/assembler.ts` | 上下文组装器：System Prompt 注入、近 10 条明文组装、**先答者全文对后答者动态可见** |
| `scheduler.ts` | `packages/engine/src/scheduler.ts` | 调度器：三模式路由、只有用户消息开新轮、单轮每人至多一答、429 指数退避、超时与主动停止 |
| `engine.ts` | `packages/engine/src/engine.ts` | ContextEngine 主入口门面：整合调度器、组装器、压缩器与事件订阅总线 |
| `index.ts` | `packages/engine/src/index.ts` | 统一导出公共 API |
| `engine.test.ts` | `packages/engine/tests/engine.test.ts` | Vitest 自动化测试套件（覆盖工单规定的 4 大必测断言 ＋ 2 项扩展测试） |
| `delivery-report.md` | `docs/delivery-report-step03.md` | 交付报告全文与验收指引 |

---

## 二、架构设计与工程红线落实说明

1. **纯前端 TS 与零外部原生依赖**：
   - 源码中严禁使用 Node.js 专属内置模块（如 `node:fs`、`node:path`、`node:child_process` 等）。
   - 零 Tauri 依赖，所有异步调度与中断均基于 Web 标准原生 `AbortController`、`Promise`、`Set`、`Map`，确保在 GitHub Pages 纯前端与桌面 Webview 之间 100% 同构运行。
2. **五大标准帧事件规范（Frame Protocol）**：
   - `typing`：模型开始推理时的呼吸状态；
   - `chunk`：多模型并发增量文本分片；
   - `agent_done`：单 Agent 结束标记（含入出 Token 与状态）；
   - `turn_done`：本轮全员会诊完成，重置发送锁；
   - `usage`：单次完成伴随抛出独立用量事件，携带 `inputTokens`、`outputTokens`，供第 5 步本地财务账本解耦消费。
3. **调度纪律与异常策略**：
   - **严格单轮防死循环**：`startNewTurn` 校验 `senderType === 'user'`，物理切断 Agent 之间互相级联触发可能。
   - **单轮每人至多一答**：调度器维护 `respondedAgentsInCurrentTurn`，同一轮次中已作答 Agent 无法再次提交。
   - **429 退避策略**：提供带有随机抖动（Jitter）的指数退避计算接口，封顶 30 秒。
   - **优雅降级与超时**：单 Agent 超时或报错不阻塞其他 Agent 的流式输出与整轮闭环。
4. **上下文互见手艺落地**：
   - 组装器设计了 `turnCompletedResponses` 挂载槽。本轮会诊中，先完成作答的 Agent 成果自动以 `【本轮会诊同伴实时作答，供协同参考】` 标签动态追加进后答者的 Prompt 中，实现多模型认知对齐与深度接力。

---

## 三、Vitest 自动化测试覆盖说明

测试套件 `packages/engine/tests/engine.test.ts` 完整实现了工单要求的四大断言，并扩充了两项健壮性验证：

- [x] **a) 只有用户消息能开新轮**：
  - 断言验证：传入 `agent` 或 `system` 消息调用 `initTurn` 均被强制拦截抛错；只有 `user` 消息成功开启新轮并自增 `turnIndex`。
- [x] **b) 每轮每 Agent 至多一答**：
  - 断言验证：同一轮内，Claude 作答完成后，`canAgentRespond('claude', turnIndex)` 立即返回 `false`；二次提交同一 Agent 作答抛出冲突异常；其他未作答 Agent 资格不受影响。
- [x] **c) 组装窗口（近 10 条＋摘要）正确**：
  - 断言验证：在 16 条密集历史场景下，组装结果明文消息数严格为 10 条历史 + 1 条当前提问（最早 6 条移出明文）；System Prompt 中成功注入 `【历史摘要】`，且字数完全约束在 200 字之内。
- [x] **d) @ 定向命中**：
  - 断言验证：输入包含 `@claude` 与 `@deepseek` 时，仅唤醒命中者，`gpt4o` 保持静默；未带 @ 标签时平滑回退至首选主导 Agent。
- [x] **e) 先答者全文对后答者可见（扩展）**：
  - 断言验证：先答者输出动态注入后答者的上下文体系，协同语义标签清晰完整。
- [x] **f) 五大事件生命周期流（扩展）**：
  - 断言验证：`typing` -> `chunk` -> `agent_done` (伴随 `usage`) -> `turn_done` 事件链顺序与结构完整无缺。

---

## 四、本地验收自检指引

Sunny 验收落仓本地后，可通过以下命令一键运行测试验证：
```bash
cd packages/engine
pnpm install
pnpm test
```
全部 6 组测试用例设计为纯单测、无外部网络交互，毫秒级快速通过。

