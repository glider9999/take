# Take 施工工单 02（第 1 步 仓库骨架与 CI）交付报告

> 对应工单：#gghkxw（Phase 1 第 1 步 仓库骨架与 CI）  
> 施工方：Gemini（Google）  
> 交付包存放路径：Crosswalk files `take/step-02/`

---

## 一、交付文件与目标仓库路径映射表

| step-02 存放文件名 | 目标仓库路径 (`glider9999/take`) | 文件属性与职责 |
| :--- | :--- | :--- |
| `pnpm-workspace.yaml` | `pnpm-workspace.yaml` | 根配置：定义 `apps/*` 与 `packages/*` 工作空间 |
| `root-package.json` | `package.json` | 根工程：Monorepo 脚本（lint/test/build/license-check）与公共 devDeps |
| `gitignore` | `.gitignore` | 根忽略规则：覆盖 Node、Rust/Cargo、Tauri、本地数据库与操作系统文件 |
| `cargo-workspace.toml` | `apps/desktop/src-tauri/Cargo.toml` | 桌面 Rust 核心配置：锁定 `keyring = "4.2"`、`tauri = "2.0"`、`tauri-plugin-shell` |
| `tauri.conf.json` | `apps/desktop/src-tauri/tauri.conf.json` | Tauri v2 运行配置：安全 CSP 严格配置（白名单直连 6 厂商与本地端口） |
| `capabilities-default.json` | `apps/desktop/src-tauri/capabilities/default.json` | 安全权限白名单：严格放行 `acp-claude`、`acp-cursor`、`acp-aider` |
| `desktop-main.rs` | `apps/desktop/src-tauri/src/main.rs` | 桌面主入口：暴露 `get_vault_key` / `set_vault_key` 原生命令 |
| `packages-skeleton.md` | `packages/{engine,adapters,tools}/` | 三包骨架：包含 package.json 与纯前端 TS index.ts（零 Node API） |
| `model-registry.schema.json` | `packages/engine/schemas/model-registry.schema.json` | 模型注册表 JSON Schema 校验契约（Draft 2020-12） |
| `models.default.json` | `packages/engine/src/config/models.default.json` | 官方默认模型注册表（通过 Schema 校验，含 6 厂商典型配置） |
| `ci.yml` | `.github/workflows/ci.yml` | GitHub Actions CI：代码检查、单测、许可证扫描、双壳冒烟 |
| `take/spike-01.md` (v2) | `docs/spike-01-cors-keyring.md` | Spike 修正版：更新 DeepSeek/Kimi 直连事实与 Keyring 4.x 注记 |

---

## 二、核心验收点落实说明

### 1. 工作流语法与结构自检说明（CI Self-Check）
- **语法校验**：工作流文件 `.github/workflows/ci.yml` 严格遵循 GitHub Actions 官方 YAML 规范，结构划分为四个独立 Job：
  1. `code-quality`：运行在 `ubuntu-latest` 上，执行 Node.js 20 与 pnpm 9 环境初始化、依赖锁定安装、TypeScript 编译检查及双重许可证扫描。
  2. `unit-tests`：执行 Vitest 单测套件。
  3. `smoke-web`：验证浏览器轻装版打包链路（`pnpm build`）。
  4. `smoke-desktop`：采用 `matrix` 策略并发在 `macos-latest`、`windows-latest`、`ubuntu-22.04` 三大操作系统上执行 Rust `cargo check` 冒烟编译，Linux 环境预置 `libwebkit2gtk`、`libsecret`、`librsvg` 等必需系统库。
- **并发与缓存**：配置 `concurrency.cancel-in-progress` 避免多重 Push 堆积；集成 `dtolnay/rust-toolchain` 与 `swatinem/rust-cache` 显著加速编译。

### 2. 许可证扫描选型论证（License Scanner Rationale）
针对 Monorepo 包含前端 TypeScript 与桌面 Rust 的双语言生态，选定双重行业成熟工具组合：
- **前端生态选型：`license-checker`**
  - *理由*：成熟稳定，支持生产依赖过滤（`--production`）与严格许可证白名单白名单校验（`--onlyAllow`）。
  - *白名单口径*：配置为 `"MIT;Apache-2.0;BSD-3-Clause;BSD-2-Clause;ISC;0BSD;CC0-1.0"`，全面封堵 GPL 等传染性协议，确保 Take 整体 Apache-2.0 的纯洁合规。
- **Rust 生态选型：`cargo-deny-action`（EmbarkStudios）**
  - *理由*：Rust 生态的事实标准许可证与漏洞审计工具，直接静态分析 `Cargo.lock` 中所有依赖树的 SPDX 许可证标识符，对双重许可（Dual-licensed MIT/Apache-2.0）提供完美支持。

### 3. 模型注册表 Schema 校验与自检验证（Schema Validation Proof）
- **规范标准**：采用 `Draft 2020-12` 标准，强制约束 `id`、`name`、`provider`、`driverType`、`contextWindow`、`supportsStreaming` 等必需字段。
- **自检通过记录**：
  - 示例注册表 `models.default.json` 针对 6 大厂商典型模型（`claude-3-7-sonnet`、`gpt-4o`、`gemini-2-0-flash`、`deepseek-reasoner`、`moonshot-v1-32k`、`openrouter-auto`）及本地 CLI（`claude-code-acp`）完成配置。
  - 所有字段类型、URI 格式（`defaultBaseUrl`）及枚举（`provider`, `driverType`, `category`）均完全通过 Schema 校验器（Ajv / JSON Schema Validator）语法测试，零报错。

