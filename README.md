# TakeChat (`glider9999/take`)

[English](README.en.md) | 简体中文

> **通用多智能体协同群聊客户端 · 真正开源、本地优先、多模型接力**  
> 基于 **Apache-2.0** 许可证开源发布

---

## 🌟 为什么选择 TakeChat？

不同于传统单模型对话工具或黑盒商业套壳，**TakeChat** 将主流 11 家大语言模型与本地命令行智能体（Claude Code 等）作为「独立联系人」并入同一个群聊房间。

- **多模型接力与认知对齐**：支持「全员会诊（在场模型各答一次）」与「@定向点名」。同一轮次中，先答模型的完整内容自动注入后答模型的上下文组装窗口中，形成天然的多智能体接力推敲。
- **11 家主流模型全量直连**：
  1. **Anthropic** (Claude 3.7 Sonnet / Claude 3.5 Sonnet)
  2. **OpenAI** (GPT-4o / o1 / o3)
  3. **Google** (Gemini 2.0 Flash / Pro)
  4. **DeepSeek** (DeepSeek V3 / R1)
  5. **Moonshot** (Kimi Moonshot v1)
  6. **OpenRouter** (Auto Router / 聚合路由)
  7. **xAI** (Grok 3 Mini / Grok 2)
  8. **阿里通义千问** (Qwen Turbo / Plus)
  9. **智谱 AI** (GLM-4 Flash / Plus)
  10. **火山引擎豆包** (Doubao Lite / 支持 ep- 推理端点 ID)
  11. **MiniMax** (MiniMax Text 01)
- **四间内置官方会诊室**：
  1. 🎨 **提示词会诊室 (Prompt Clinic)**：针对 AI 视频与生图提示词进行多模型词条压制、构图推敲与镜头语言优化；
  2. 🛠️ **ComfyUI 报错会诊室 (ComfyUI Repair)**：提交本地工作流 JSON，全自动排查报错节点，生成标准结构化会诊单；
  3. 🎬 **分镜与镜头会诊室 (Storyboard & Camera Clinic)**：情节点拆镜、景别规划、出图提示词提炼、整表汇总与 ComfyUI 样片生成；
  4. 💡 **通用会诊室 (General Clinic)**：开放式多角色头脑风暴、复杂代码推理与方案会诊。
- **严格本地优先与隐私守门**：零数据上报、零云端中转服务器。所有 API 密钥、聊天历史与账本数据完全保留在用户本地操作系统钥匙串或浏览器本地存储中。支持在设置中一键删除已存 Key，无残留。
- **轻装/完全双端架构**：
  - 🌐 **Web 轻装版**：静态部署于 GitHub Pages，免安装即开即用，直接直连厂商官方 API，零私网穿透负担；
  - 🖥️ **Desktop 完全版**：基于 Tauri v2 驱动，完整支持本地操作系统钥匙串、ACP 协议子进程（Claude Code、Cursor、Aider）及 ComfyUI 本地直连。

---

## 🛠️ 从源码拓扑构建

本项目采用 `pnpm workspaces` Monorepo 组织架构。核心包编译输出存在依赖拓扑顺序，构建时须严格执行：

```bash
# 1. 克隆代码仓库
git clone https://github.com/glider9999/take.git
cd take

# 2. 安装所有依赖
pnpm install

# 3. 按拓扑序全量编译 (engine -> adapters -> ui -> web / desktop)
pnpm -r build
```

### 启动本地开发服务
- **启动浏览器 Web 版**：
  ```bash
  pnpm --filter @take/web dev
  # 浏览器打开 http://localhost:3000
  ```
- **启动桌面客户端开发态**：
  ```bash
  pnpm --filter @take/desktop tauri dev
  ```
- **运行自动化单元测试套件**：
  ```bash
  pnpm test
  ```

---

## 🛡️ 未签名安装放行指南 (Gatekeeper / SmartScreen)

为保障 TakeChat 的 100% 自由与社区属性，初始版本未打包商业签名证书。代码完全开放可审计，若系统提示未受信任开发者，请按以下指引放行：

### 1. macOS (Apple Gatekeeper)
- **现象**：提示「无法打开 TakeChat，因为无法验证开发者」
- **解决**：
  - **图形界面**：前往 **系统设置** -> **隐私与安全性** -> 向下滚动至「安全性」 -> 点击 **「仍要打开」**；
  - **终端命令**：
    ```bash
    xattr -cr /Applications/TakeChat.app
    ```

### 2. Windows (Microsoft Defender SmartScreen)
- **现象**：提示「Windows 已保护你的电脑 - Microsoft Defender SmartScreen 阻止了未知应用的启动」
- **解决**：
  - 点击界面上的 **「详细信息」** (More info)；
  - 点击出现的 **「仍要运行」** (Run anyway) 按钮。

### 3. Linux
- 为 `.AppImage` 授予可执行权限：
  ```bash
  chmod +x TakeChat-x.x.x.AppImage
  ./TakeChat-x.x.x.AppImage
  ```

---

## 🔒 密钥安全与连接自检

- **浏览器轻装版**：API Key 仅存于当前浏览器的 **本地存储 (Local Storage)**，请勿在公共或共享电脑上填入生产 Key；支持随时点击「删除 Key」即刻清除；
- **桌面完全版**：API Key 通过系统原生钥匙串硬件级加密隔离保存（macOS Keychain / Windows Credential Manager）；
- **连接自检**：在 **设置** 弹窗中提供 11 家厂商及 ComfyUI 的「测试连接」独立自检，发起最小探针并反馈响应耗时，不计入会话历史或账本。

---

## 📄 开源许可证

本项目基于 **Apache License, Version 2.0** 许可证开源发布。第三方依赖许可证审计详见 `THIRD_PARTY_NOTICES.md`。
