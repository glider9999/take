# TakeChat (`glider9999/take`)

English | [简体中文](README.md)

> **Universal Multi-Agent Collaborative Group Chat Client · Truly Open Source, Local-First Privacy, Multi-Model Synergy**  
> Licensed under **Apache-2.0**

---

## 🌟 Why TakeChat?

Unlike conventional single-model interfaces or closed proprietary wrappers, **TakeChat** brings multiple AI assistants (Claude, ChatGPT, Gemini, DeepSeek, Moonshot, Grok, etc.) and local coding CLIs together as "independent contacts" in a unified group chat.

- **Multi-Agent Relay & Aligned Cognition**: Supports "Group Consultation (All respond once per turn)" and "@Mention Direct Mode". Earlier agent responses automatically become visible context for subsequent agents in the same turn, enabling structured multi-agent relay.
- **Four Official Built-in Clinic Rooms**:
  1. 🎨 **Prompt Clinic**: Multi-model prompt polishing, constraint compression, and vision-to-prompt tuning;
  2. 🛠️ **ComfyUI Repair**: Workflow JSON submission, queue polling, and structured node error diagnosis;
  3. 🎬 **Storyboard & Camera Clinic**: Scene breakdown, shot scale planning, camera prompt generation, and storyboard table summary;
  4. 💡 **General Clinic**: Open-ended multi-agent brainstorming and collaborative problem solving.
- **Strictly Local-First Privacy**: Zero telemetry, zero middleman proxy servers. API keys and chat history stay locked inside your OS native credential vault or local browser storage.
- **Dual Edition Architecture**:
  - 🌐 **Web Lightweight Edition**: Hosted statically on GitHub Pages, zero-install, direct cloud API connections, zero hosting overhead;
  - 🖥️ **Desktop Native Edition**: Powered by Tauri v2 with Rust, supporting cloud APIs + local ACP/CLIs (Claude Code, Cursor ACP, Aider) + local ComfyUI workflow diagnostics.

---

## 🛠️ Building from Source (Topological Order)

This project is organized as a `pnpm workspaces` Monorepo. Builds must follow the **topological dependency sequence**:

```bash
# 1. Clone the repository
git clone https://github.com/glider9999/take.git
cd take

# 2. Install dependencies
pnpm install

# 3. Build all packages in topological sequence (engine -> adapters -> ui -> web / desktop)
pnpm -r build
```

### Running Local Development Servers
- **Run Browser Web App**:
  ```bash
  pnpm --filter @take/web dev
  # Open http://localhost:3000
  ```
- **Run Desktop Native Client**:
  ```bash
  pnpm --filter @take/desktop tauri dev
  ```
- **Run Automated Vitest Test Suites**:
  ```bash
  pnpm test
  ```

---

## 🛡️ Unsigned Binary Security Bypass (Gatekeeper / SmartScreen)

To keep TakeChat 100% free and community-driven, releases do not bundle proprietary commercial certificates at this initial stage. The code is completely open, auditable, and malware-free. If your operating system warns about an unidentified developer, please follow these steps:

### 1. macOS (Apple Gatekeeper)
- **Symptom**: "TakeChat cannot be opened because the developer cannot be verified."
- **Solution**:
  - **Option A (GUI)**: Go to **System Settings** -> **Privacy & Security** -> scroll down to "Security" -> Click **"Open Anyway"** for TakeChat.
  - **Option B (Terminal)**:
    ```bash
    xattr -cr /Applications/TakeChat.app
    ```

### 2. Windows (Microsoft Defender SmartScreen)
- **Symptom**: "Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting."
- **Solution**:
  - Click **"More info"**;
  - Click the **"Run anyway"** button.

### 3. Linux
- Make the `.AppImage` executable:
  ```bash
  chmod +x TakeChat-x.x.x.AppImage
  ./TakeChat-x.x.x.AppImage
  ```

---

## 🔒 Security & API Key Safety Notice

- **Browser Edition**: API Keys are stored **exclusively in your browser's local storage**. Never input high-spend production keys on shared or public devices.
- **Desktop Edition**: API Keys are stored via the operating system native credential vault (`keyring`: macOS Keychain / Windows Credential Manager / Linux Secret Service).
- **Connection Diagnostics**: Test API connectivity directly inside **Settings** (runs isolated minimal ping probes without saving to chat history or usage ledgers).

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See `LICENSE` and `THIRD_PARTY_NOTICES.md` for complete details.
