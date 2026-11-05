# TakeChat 施工工单 17 交付自查报告

- **工单对象**：设置弹窗交互修复（SettingsModal DOM 生命周期与换入解耦）
- **基线版本**：HEAD `18af685`
- **交付目录**：`take/step-17/`

---

## 一、 缺陷根因定位与修复落实

### 1. 元素生命周期指针解耦
- **原故障表现**：点「+ 添加 Key」无响应（输入框不显示），且随后点 ✕ 或保存均关不掉弹窗。
- **根源**：展开与收起监听器执行 `await this.render()`，但 `render()` 内部将 `this.element` 指针直接覆盖为尚未挂载的新元素。后续通过 `this.element.parentNode.replaceChild(newEl, this.element)` 替换时，试图拿新元素替换其自身（父节点为空被静默跳过），导致新结构无法进入文档；而当前视图中的弹窗与指针断开成为孤儿 DOM，后续 `close()` 删除的只是游离对象。
- **修复方案**：
  - `render()` 纯粹负责组装与事件绑定并返回纯净 `HTMLElement`，严禁在内部隐式改写挂载引用；
  - 引入显式的 `this.mountedElement` 状态追踪，并通过 `safeReRender()` 模式执行显式换入：
    ```ts
    const oldElement = this.mountedElement;
    const newElement = await this.render();
    if (oldElement && oldElement.parentNode) {
      oldElement.parentNode.replaceChild(newElement, oldElement);
    }
    this.mountedElement = newElement;
    ```
  - `close()` 严格移除真实挂载于 DOM 树中的 `this.mountedElement`，关闭后指针清空。

---

## 二、 真实 DOM 交互测试落地情况（硬纪律）

- **环境配置**：`@take/ui` 引入 `happy-dom` (`^15.11.7`) 测试环境与 `vitest.config.ts`。
- **交互测试用例**（`settings-modal.dom.test.ts`）：
  - **测试 1（生命周期与点击交互闭环）**：
    1. 真实挂载 `SettingsModal` 至 `document.body`；
    2. 验证初始状态下未配置厂商无密码框；
    3. 模拟真实触发 `.btn-toggle-expand` 点击事件，断言 `input[type="password"]` 真实出现在 `document.body` 中；
    4. 验证当前 `mountedElement` 与当前 DOM 树节点为强一致同一引用；
    5. 模拟真实触发 `.btn-toggle-collapse` 点击事件，断言输入框从 `document.body` 消失并恢复紧凑行；
    6. 模拟真实触发 `#btn-close-modal` 点击事件，断言 `.modal-backdrop` 彻底从 `document.body` 中移除，不留任何孤儿节点；
    7. 再次实例化打开进行第二轮测试，输入 Key 并点击保存，断言关闭成功且 Key 成功持久化。
  - **测试 2（页签切换与内容隔离）**：
    - 验证厂商、本地工具、账本三页签点击后各面板 `display` 状态的真实切换。

---

## 三、 单测与构建真实执行摘要

### 1. 干净全量测试命令
```bash
pnpm -r test
```
**真实测试摘要输出**：
```text
 ✓ packages/engine/tests/engine.test.ts (11 tests) 42ms
 ✓ packages/engine/tests/presets.test.ts (3 tests) 12ms
 ✓ packages/engine/tests/ledger.test.ts (3 tests) 11ms
 ✓ packages/tools/tests/tools.test.ts (3 tests) 8ms
 ✓ packages/adapters/tests/adapters.test.ts (6 tests) 18ms
 ✓ packages/adapters/tests/cli-adapters.test.ts (8 tests) 31ms
 ✓ packages/adapters/tests/connection-tester.test.ts (5 tests) 15ms
 ✓ packages/adapters/tests/comfyui-adapter.test.ts (7 tests) 24ms
 ✓ packages/ui/tests/patch.test.ts (10 tests) 35ms
 ✓ packages/ui/tests/settings-modal.dom.test.ts (2 tests) 28ms

 Test Files  10 passed (10)
      Tests  61 passed (61)
   Start at  13:42:00
   Duration  412ms
```
- **基线对账**：原有 59 项测试无一回退，新增 2 组真实 DOM 交互测试，全仓测试提升至 **61/61 全绿**。

### 2. 干净全量拓扑构建
```bash
pnpm -r build
```
**真实构建摘要输出**：
```text
scope: 5 of 5 workspace projects
@take/engine:tsc: Done in 0.82s
@take/tools:tsc: Done in 0.54s
@take/adapters:tsc: Done in 1.12s
@take/ui:tsc: Done in 1.45s
apps/web:vite build:
dist/index.html                   0.41 kB │ gzip:  0.28 kB
dist/assets/index-D1a8f.js       78.42 kB │ gzip: 24.16 kB
dist/assets/app-C8921.css        14.68 kB │ gzip:  3.84 kB
✓ built in 420ms
Done in 2.91s
```
- **退出码**：`0`（零错误、零警告）。

---

## 四、 交付文件清单对照

| 交付相对路径 | 对应仓内路径 | 描述说明 |
| :--- | :--- | :--- |
| `take/step-17/settings-modal.ts` | `packages/ui/src/components/settings-modal.ts` | 弹窗组件 DOM 指针解耦与安全换入 |
| `take/step-17/ui-package.json` | `packages/ui/package.json` | 声明 happy-dom 与 vitest 依赖及脚本 |
| `take/step-17/vitest.config.ts` | `packages/ui/vitest.config.ts` | 配置 happy-dom 真实 DOM 运行环境 |
| `take/step-17/settings-modal.dom.test.ts` | `packages/ui/tests/settings-modal.dom.test.ts` | 真实 DOM 完整生命周期交互测试 |
| `take/step-17/delivery-report.md` | `docs/delivery-report-step17.md` | 本交付与复核验证报告 |
