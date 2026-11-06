# TakeChat (`glider9999/take`)

English | [简体中文](README.md)

> **Universal Multi-Agent Collaborative Group Chat Client · Truly Open Source, Local-First, Relay-Driven**  
> Released under the **Apache-2.0** License

---

## 🌟 Why TakeChat?

Unlike conventional single-model interfaces or proprietary commercial wrappers, **TakeChat** treats 11 major cloud LLMs and local CLI agents (such as Claude Code) as independent contacts within shared discussion rooms.

- **Multi-Model Relay & Cognitive Alignment**: Supports "All models reply (each once)" and "@mention direct reply". Preceding model responses are automatically injected into subsequent models' context windows for seamless iterative deliberation.
- **11 Cloud Model Providers Supported Directly**:
  1. **Anthropic** (Claude 3.7 Sonnet / Claude 3.5 Sonnet)
  2. **OpenAI** (GPT-4o / o1 / o3)
  3. **Google** (Gemini 2.0 Flash / Pro)
  4. **DeepSeek** (DeepSeek V3 / R1)
  5. **Moonshot** (Kimi Moonshot v1)
  6. **OpenRouter** (Auto Router / Aggregation)
  7. **xAI** (Grok 3 Mini / Grok 2)
  8. **Alibaba Qwen** (Qwen Turbo / Plus)
  9. **Zhipu AI** (GLM-4 Flash / Plus)
  10. **Volcengine Doubao** (Doubao Lite / Inference Endpoint ID ep-xxx)
  11. **MiniMax** (MiniMax Text 01)
- **Four Official Clinic Rooms**:
  1. 🎨 **Prompt Clinic**: Multi-model video/image prompt refinement and cinematography optimization;
  2. 🛠️ **ComfyUI Repair**: Automated workflow node diagnosis with structured error case sheets;
  3. 🎬 **Storyboard & Camera Clinic**: Scene breakdown, shot scale planning, table summaries, and preview rendering;
  4. 💡 **General Clinic**: Open multi-agent brainstorming and complex reasoning.
- **Local-First & Key Safety**: Zero cloud telemetry, zero relay servers. Keys and data are stored in system keychain or browser local storage, with one-click key deletion support.
- **Dual Architecture (Web / Desktop)**:
  - 🌐 **Web Edition**: Hosted statically on GitHub Pages, connects directly to official APIs without private network issues;
  - 🖥️ **Desktop Edition**: Tauri v2-powered with system keychain security, ACP stdio processes, and ComfyUI local connections.

---

## 🛠️ Build from Source

```bash
git clone https://github.com/glider9999/take.git
cd take
pnpm install
pnpm -r build
```

Run test suite:
```bash
pnpm test
```

---

## 🔒 License

Apache License, Version 2.0. See `THIRD_PARTY_NOTICES.md` for audits.
