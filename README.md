# TakeChat (`glider9999/take`)

> **通用多智能体群聊协作客户端 · 真正开源、纯本地安全、多厂商大模型协同**  
> 遵循 **Apache-2.0** 开源许可证

---

## 🌟 为什么选择 TakeChat？

与传统单模型聊天界面或封闭商业客户端不同，**TakeChat** 将多家 AI（Claude、ChatGPT、Gemini、DeepSeek、Kimi、Grok 等）及本地编程 CLI 作为“独立联系人”拉进同一个群聊。

- **八对一智囊团协作**：支持单聊、@定向点名与全员会诊三种模式。
- **动态互见手艺**：先答者的输出结论自动对后答者可见，形成多模型认知对齐与深度接力。
- **纯本地绝对安全**：零中心服务器，数据与密钥全程锁在操作系统原生安全凭据库或浏览器本地。
- **双版本并行**：
  - 🌐 **浏览器轻装版**：托管于 GitHub Pages，打开网页即用，只连云端 API，零服务器运维。
  - 🖥️ **本地部署完全版**：基于 Tauri v2 驱动的轻量桌面端，支持云端 API ＋ 本地 CLI/ACP ＋ 本地 ComfyUI 影像排错全能力。

---

## 🛠️ 从源码构建（拓扑依赖构建说明）

本项目采用 `pnpm workspaces` Monorepo 架构。由于各外壳与应用直接依赖内部核心包编译后的产物，构建时必须严格遵循**拓扑依赖编译顺序**：

```bash
# 1. 克隆代码仓库
git clone https://github.com/glider9999/take.git
cd take

# 2. 安装全部工程依赖
pnpm install

# 3. 按照拓扑依赖顺序全量构建（engine -> ui -> adapters -> web / desktop）
pnpm -r build
```

### 分模块独立运行与开发调试
- **运行浏览器 Web 开发服**：
  ```bash
  pnpm --filter @take/web dev
  # 浏览器访问 http://localhost:3000
  ```
- **运行桌面原生客户端**：
  ```bash
  pnpm --filter @take/desktop tauri dev
  ```
- **执行自动化单元测试套件**：
  ```bash
  # 运行引擎与账本单测
  pnpm --filter @take/engine test
  # 运行连接层与适配器单测
  pnpm --filter @take/adapters test
  # 运行工具权限门单测
  pnpm --filter @take/tools test
  ```

---

## 🛡️ 未签名安装放行指南（Gatekeeper / SmartScreen 绕行说明）

为了让所有开源社区用户零门槛自由使用，TakeChat 首发阶段暂缓采购昂贵的企业签名证书（无代码篡改，完全开源透明）。因此在首次安装桌面客户端时，系统可能会弹出未知开发者安全提示，请按以下指引手动放行：

### 1. macOS (Apple Gatekeeper 拦截处理)
- **现象**：双击 `.dmg` 安装并打开应用时，系统弹出提示：“无法打开 TakeChat，因为无法验证开发者”。
- **放行方法（任选其一）**：
  - **方法 A（界面操作）**：打开 macOS「系统设置」->「隐私与安全性」，向下滑动至“安全性”一栏，会看到“已阻止使用 TakeChat”，点击右侧的 **「仍要打开」**，输入开机密码即可正常运行。
  - **方法 B（终端单行命令）**：打开「终端」App，执行以下命令清除隔离属性：
    ```bash
    xattr -cr /Applications/TakeChat.app
    ```

### 2. Windows (Microsoft Defender SmartScreen 拦截处理)
- **现象**：双击运行安装包时，弹出蓝色窗口提示：“Windows 已保护你的电脑，Microsoft Defender SmartScreen 已阻止无法识别的应用启动”。
- **放行方法**：
  - 点击提示弹窗中的 **「更多信息」**（More info）超链接；
  - 随后点击右下角出现的 **「仍要运行」**（Run anyway）按钮即可开始安装。

### 3. Linux
- 下载 `.AppImage` 文件后，赋予可执行权限即可直接运行：
  ```bash
  chmod +x TakeChat-x.x.x.AppImage
  ./TakeChat-x.x.x.AppImage
  ```

---

## 📄 开源许可证与社区合规

本项目遵循 **Apache License 2.0** 许可证开源，完整第三方开源依赖声明详见 `THIRD_PARTY_NOTICES.md`。

