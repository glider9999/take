# Take

**An open-source group-chat client that brings multiple AI agents into one conversation to work together.**

把多家 AI 拉进一个群，分工干活。/ Bring Claude, ChatGPT, Gemini, Grok, Kimi, DeepSeek — and your local CLI agents — into a single group chat, share one context, and let each do what it does best.

![License](https://img.shields.io/badge/license-Apache--2.0-blue) ![Status](https://img.shields.io/badge/status-pre--production-orange)

> Status: **pre-production**. The architecture is finalised (see [docs/take-framework-final.md](docs/take-framework-final.md)); Phase 1 implementation has not started yet. The first release will ship **unsigned** — see the install notes under [Quick start](#quick-start).

## Why Take

Single-model tools work in isolation: you copy prompts from one app, paste answers into another, and lose the thread in between. Closed multi-agent tools keep your keys and your projects on someone else's server.

Take takes the opposite route:

- **Many agents, one room** — cloud APIs and local CLI agents in the same group chat, sharing context, taking turns, handing work to each other.
- **Local first** — no central server. Your keys and data stay on your machine; traffic goes from your device straight to each provider's official API.
- **APIs + local CLIs mixed** — hosted models for reach, local agents (via ACP / PTY adapters) and local tools such as ComfyUI for real work.
- **Fully open source** — Apache-2.0, auditable, self-installed.
- **For any work** — Take grew out of AI filmmaking (a director consulting several models at once), and that is only the launch scenario. Writing, coding, research, planning: any task where several AIs are better than one.

## Features

- Group chat with multiple AI providers side by side: single chat, @-mention, or full-panel consultation modes
- Built-in loop protection and context control (recent-window + rolling summary), so a session cannot spiral or silently burn budget
- Local usage ledger with your own soft budget alerts — no server-side metering, no surprises
- Tool access in three permission tiers; destructive actions always require your explicit click
- Preset rooms and custom agents: ship a room setup as a shareable preset package and import others'
- Two editions, one engine and one UI:
  - **Browser edition** — pure front-end, runs from a static page, keys stored in your browser, cloud APIs only
  - **Local edition** — Tauri v2 desktop app (or Docker local Web), with OS-keychain key storage, local CLI agents and local tools

## Quick start

Planned distribution (Phase 3):

1. **Browser edition**: open the GitHub Pages site, add your provider keys, start your first room. No install.
2. **Desktop edition**: download the build for macOS / Windows / Linux from Releases, launch it, add your keys.
   - Early builds are **unsigned**. On macOS, if Gatekeeper blocks the app, right-click the app and choose **Open**, then confirm. On Windows, if SmartScreen warns, choose **More info → Run anyway**.
3. **Docker**: `docker run -d -p 3000:3000 -v ~/.take-data:/app/data glider9999/take:latest`, then open http://localhost:3000
4. **Developers**: Node.js ≥ 20 + Rust toolchain, then `pnpm install && pnpm tauri dev`

## Security

- No central server, no telemetry of your conversations: by design there is nowhere for your data to be reported to.
- Local edition stores keys in the OS credential store (macOS Keychain / Windows Credential Manager / Linux Secret Service) via the OS keyring — never in plain text files.
- Browser edition stores keys in your browser's local storage. That is **less secure** than the local edition; the UI says so plainly, and an optional session-only mode keeps keys only until the tab closes.
- Tool calls run under a three-tier permission model; shell execution and file writes always stop for your confirmation.

## 中文简介

Take 是一个开源的多智能体群聊客户端：把 Claude、ChatGPT、Gemini、Grok、Kimi、DeepSeek 等多家 AI（以及你本机的 CLI Agent）拉进同一个群聊，共享上下文、轮流接力、各展所长。它源于 AI 影像创作中「多个模型会诊」的真实用法，但适用于一切工作。无中心服务器，Key 与数据只存你本机；首发两个版本——浏览器版（纯前端、即开即用）与本地部署版（Tauri 桌面 / Docker，全能力）。由 [take.hk](https://take.hk) 发起与分享。

## Documentation

- [Final architecture & implementation framework (定版母本)](docs/take-framework-final.md) — the build source of truth: positioning, editions, context engine, security model, repository layout, phasing.

## License

Apache License 2.0 — see [LICENSE](LICENSE). The Apache-2.0 license does not grant rights to the **Take** name or brand assets.
