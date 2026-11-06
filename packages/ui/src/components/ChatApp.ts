/**
 * @take/ui - ChatApp.ts (工单 19 扩容 12 家终版)
 * 增加 NVIDIA 智能体身份（Nv / meta/llama-3.3-70b-instruct），支持入新对话与 @ 候选
 */

import { ContextEngine, Session, AgentProfile, EngineEvent, LocalLedger, StoryboardManager } from '@take/engine';
import { BrowserKeyStore, DesktopKeyStore, KeyStore } from '@take/adapters';
import { t, getLocale, setLocale, TranslationDict } from '../i18n/index.js';
import { SettingsModal } from './SettingsModal.js';

export interface ChatAppOptions {
  container: HTMLElement;
  isDesktop?: boolean;
}

export interface ExtendedAgentProfile extends AgentProfile {
  shortName: string;
  avatarClass: string;
  driverType?: 'cloud_api' | 'local_acp' | 'local_pty';
  roleZh: string;
  roleEn: string;
  status: 'spoke' | 'ready' | 'thinking' | 'no_key';
}

export interface CustomRoomMeta {
  id: string;
  name: string;
  isPreset?: boolean;
  activeAgentIds: string[];
}

export interface DemoStepDefinition {
  key: keyof TranslationDict;
  actorId?: string;
  defaultState: 'done' | 'doing' | 'wait';
}

export interface DemoMemberDefinition {
  agentId: string;
  defaultStatus: 'spoke' | 'ready';
}

export interface RoomDemoDefinition {
  progressTitleKey: keyof TranslationDict;
  steps: DemoStepDefinition[];
  members?: DemoMemberDefinition[];
}

export const ROOM_DEMO_DEFINITIONS: Record<string, RoomDemoDefinition> = {
  'prompt-clinic': {
    progressTitleKey: 'progressTitle',
    steps: [
      { key: 'stepPromptClaude', actorId: 'Cl', defaultState: 'done' },
      { key: 'stepWorkflowGrok', actorId: 'Gr', defaultState: 'done' },
      { key: 'stepStoryboardChatgpt', actorId: 'Gp', defaultState: 'done' },
      { key: 'stepCodeDeepseek', actorId: 'Ds', defaultState: 'doing' },
      { key: 'stepHostSummary', actorId: 'Host', defaultState: 'wait' },
    ],
    members: [
      { agentId: 'Cl', defaultStatus: 'spoke' },
      { agentId: 'Gp', defaultStatus: 'spoke' },
      { agentId: 'Ds', defaultStatus: 'ready' },
      { agentId: 'Gr', defaultStatus: 'ready' },
      { agentId: 'Ge', defaultStatus: 'ready' },
    ],
  },
  'comfyui-fix': {
    progressTitleKey: 'comfyProgressTitle',
    steps: [
      { key: 'stepComfyLoad', actorId: 'User', defaultState: 'done' },
      { key: 'stepComfyProbe', actorId: 'Adapter', defaultState: 'done' },
      { key: 'stepComfyError', actorId: 'Gr', defaultState: 'done' },
      { key: 'stepComfyDiag', actorId: 'Ds', defaultState: 'doing' },
      { key: 'stepComfyFix', actorId: 'Cl', defaultState: 'wait' },
    ],
    members: [
      { agentId: 'Gr', defaultStatus: 'spoke' },
      { agentId: 'Ds', defaultStatus: 'ready' },
      { agentId: 'Cl', defaultStatus: 'ready' },
    ],
  },
  'general-clinic': {
    progressTitleKey: 'generalProgressTitle',
    steps: [
      { key: 'stepGeneralBreakdown', actorId: 'Host', defaultState: 'done' },
      { key: 'stepGeneralIdeas', actorId: 'All', defaultState: 'done' },
      { key: 'stepGeneralReasoning', actorId: 'Ds', defaultState: 'doing' },
      { key: 'stepGeneralDecision', actorId: 'User', defaultState: 'wait' },
    ],
    members: [
      { agentId: 'Cl', defaultStatus: 'spoke' },
      { agentId: 'Ds', defaultStatus: 'ready' },
      { agentId: 'Ge', defaultStatus: 'ready' },
    ],
  },
  'storyboard-clinic': {
    progressTitleKey: 'storyboardProgressTitle',
    steps: [
      { key: 'stepStoryboardChatgpt', actorId: 'Gp', defaultState: 'done' },
      { key: 'stepPromptClaude', actorId: 'Cl', defaultState: 'done' },
      { key: 'stepWorkflowGrok', actorId: 'Gr', defaultState: 'doing' },
      { key: 'stepHostSummary', actorId: 'Host', defaultState: 'wait' },
    ],
  },
};

const STORAGE_ROOMS_KEY = 'takechat_rooms_meta_v1';

export class ChatApp {
  private container: HTMLElement;
  private isDesktop: boolean;
  private engine: ContextEngine;
  private ledger: LocalLedger;
  private keyStore: KeyStore;
  private session: Session;
  private agents: ExtendedAgentProfile[];
  private storyboard: StoryboardManager;
  private isBroadcastMode: boolean = true;
  private isGenerating: boolean = false;
  private thinkingAgents: Set<string> = new Set();
  private activeModal: SettingsModal | null = null;
  private currentRoomId: string = 'prompt-clinic';
  private hasLoadedDemo: boolean = false;

  private rooms: CustomRoomMeta[] = [];
  private mentionQuery: string | null = null;
  private selectedMentionIndex: number = 0;

  constructor(options: ChatAppOptions) {
    this.container = options.container;
    this.isDesktop = options.isDesktop ?? false;
    this.engine = new ContextEngine();
    this.ledger = new LocalLedger({ sessionLimitUsd: 2.0, monthlyLimitUsd: 20.0 });

    if (this.isDesktop) {
      this.keyStore = new DesktopKeyStore(async (cmd, args) => {
        if (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined') {
          return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
        }
        return (window as any).localStorage?.getItem(`vault_${args.provider}`) || '';
      });
    } else {
      this.keyStore = new BrowserKeyStore();
    }

    this.storyboard = new StoryboardManager([
      {
        shotNumber: 1,
        shotScale: '全景',
        visualContent: '深夜便利店外景，女孩撑伞走过水洼，霓虹倒影闪烁',
        prompt: 'cinematic wide shot, convenience store at night, puddles reflecting neon lights, 35mm, slow tracking shot',
        status: 'pending',
        updatedBy: 'Grok Bot',
      },
      {
        shotNumber: 2,
        shotScale: '过肩中景',
        visualContent: '雨幕中女孩撑伞侧脸，冷色调色温，雨滴顺伞沿滑落',
        prompt: 'over-the-shoulder medium shot, girl profile under transparent umbrella, rain droplets falling, cold teal tone',
        status: 'pending',
        updatedBy: 'Claude',
      },
      {
        shotNumber: 3,
        shotScale: '特写',
        visualContent: '水洼中倒映的粉青色便利店霓虹招牌与涟漪特写',
        prompt: 'macro close-up, neon magenta reflections in water ripple, shallow depth of field, anamorphic lens',
        status: 'pending',
        updatedBy: 'ChatGPT',
      },
    ]);

    // 12 家厂商智能体身份全量定义（含 NVIDIA）
    this.agents = [
      { id: 'Cl', name: 'Claude', shortName: 'Cl', avatarClass: 'a-claude', roleZh: '提示词专家', roleEn: 'Prompt Specialist', systemPrompt: '提示词专家', provider: 'anthropic', modelName: 'claude-3-7-sonnet', driverType: 'cloud_api', status: 'ready' },
      { id: 'Gp', name: 'ChatGPT', shortName: 'Gp', avatarClass: 'a-gpt', roleZh: '分镜师', roleEn: 'Storyboard Artist', systemPrompt: '分镜师', provider: 'openai', modelName: 'gpt-4o', driverType: 'cloud_api', status: 'ready' },
      { id: 'Ge', name: 'Gemini', shortName: 'Ge', avatarClass: 'a-gem', roleZh: '知识检索', roleEn: 'Knowledge Retrieval', systemPrompt: '知识检索', provider: 'google', modelName: 'gemini-2-0-flash', driverType: 'cloud_api', status: 'ready' },
      { id: 'Ds', name: 'DeepSeek', shortName: 'DS', avatarClass: 'a-ds', roleZh: '技术推理', roleEn: 'Technical Reasoning', systemPrompt: '技术推理', provider: 'deepseek', modelName: 'deepseek-reasoner', driverType: 'cloud_api', status: 'ready' },
      { id: 'Gr', name: 'Grok Bot', shortName: 'Gr', avatarClass: 'a-grok', roleZh: '工作流专家', roleEn: 'Workflow Specialist', systemPrompt: '工作流专家', provider: 'xai', modelName: 'grok-3-mini', driverType: 'cloud_api', status: 'ready' },
      { id: 'Km', name: 'Kimi', shortName: 'Km', avatarClass: 'a-kimi', roleZh: '长文专家', roleEn: 'Long Context Specialist', systemPrompt: '长文专家', provider: 'moonshot', modelName: 'moonshot-v1-32k', driverType: 'cloud_api', status: 'ready' },
      { id: 'Or', name: 'OpenRouter', shortName: 'Or', avatarClass: 'a-or', roleZh: '聚合路由', roleEn: 'Multi-Model Router', systemPrompt: '聚合路由', provider: 'openrouter', modelName: 'openrouter-auto', driverType: 'cloud_api', status: 'ready' },
      { id: 'Qw', name: '千问 Qwen', shortName: 'Qw', avatarClass: 'a-qwen', roleZh: '通义专家', roleEn: 'Qwen Specialist', systemPrompt: '通义千问', provider: 'qwen', modelName: 'qwen-turbo', driverType: 'cloud_api', status: 'ready' },
      { id: 'Gl', name: '智谱 GLM', shortName: 'Gl', avatarClass: 'a-glm', roleZh: '清言专家', roleEn: 'GLM Specialist', systemPrompt: '智谱清言', provider: 'zhipu', modelName: 'glm-4-flash', driverType: 'cloud_api', status: 'ready' },
      { id: 'Db', name: '豆包 Doubao', shortName: 'Db', avatarClass: 'a-db', roleZh: '火山助手', roleEn: 'Doubao Assistant', systemPrompt: '豆包助手', provider: 'doubao', modelName: 'doubao-lite-128k', driverType: 'cloud_api', status: 'ready' },
      { id: 'Mx', name: 'MiniMax', shortName: 'Mx', avatarClass: 'a-mx', roleZh: '文本生成', roleEn: 'Text Synthesis', systemPrompt: 'MiniMax', provider: 'minimax', modelName: 'MiniMax-Text-01', driverType: 'cloud_api', status: 'ready' },
      // 工单 19 新增：NVIDIA
      { id: 'Nv', name: 'NVIDIA', shortName: 'Nv', avatarClass: 'a-nv', roleZh: '开源聚合 · 算力推理', roleEn: 'NVIDIA Inference · Open Models', systemPrompt: 'NVIDIA 算力推理', provider: 'nvidia', modelName: 'meta/llama-3.3-70b-instruct', driverType: 'cloud_api', status: 'ready' },
      { id: 'Cc', name: 'Claude Code', shortName: 'Cc', avatarClass: 'a-cli', roleZh: '本地编程', roleEn: 'Local Coding', systemPrompt: '本地 ACP 架构', provider: 'local-cli', modelName: 'claude-code-acp', driverType: 'local_acp', status: 'ready' },
    ];

    this.initRooms();

    this.session = {
      id: 'session-main',
      roomId: this.currentRoomId,
      title: 'TakeChat 会诊',
      history: [],
      activeAgentIds: this.getCurrentRoom()?.activeAgentIds || ['Cl', 'Gp', 'Ds', 'Gr'],
      tokenBudget: 50000,
      totalTokensUsed: 0,
      isClosed: false,
    };

    this.setupEngineListeners();
  }

  private initRooms(): void {
    try {
      const saved = typeof window !== 'undefined' && window.localStorage?.getItem(STORAGE_ROOMS_KEY);
      if (saved) {
        this.rooms = JSON.parse(saved);
      }
    } catch {
      // 容错
    }

    if (!this.rooms || this.rooms.length === 0) {
      this.rooms = [
        { id: 'prompt-clinic', name: t('promptClinic'), isPreset: true, activeAgentIds: ['Cl', 'Gp', 'Ds', 'Gr', 'Ge'] },
        { id: 'comfyui-fix', name: t('comfyFix'), isPreset: true, activeAgentIds: ['Gr', 'Ds', 'Cl'] },
        { id: 'storyboard-clinic', name: t('storyboardClinic'), isPreset: true, activeAgentIds: ['Gp', 'Cl', 'Gr'] },
        { id: 'general-clinic', name: t('generalClinic'), isPreset: true, activeAgentIds: ['Cl', 'Ds', 'Ge'] },
      ];
      this.saveRooms();
    }

    if (!this.rooms.some((r) => r.id === this.currentRoomId) && this.rooms.length > 0) {
      this.currentRoomId = this.rooms[0].id;
    }
  }

  private saveRooms(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(this.rooms));
      }
    } catch {
      // 容错
    }
  }

  private getCurrentRoom(): CustomRoomMeta | undefined {
    return this.rooms.find((r) => r.id === this.currentRoomId);
  }

  public mount(): void {
    const curLocale = getLocale();
    if (typeof document !== 'undefined') {
      document.title = curLocale === 'zh-CN' ? 'TakeChat · 多智能体协作群聊' : 'TakeChat · Multi-Agent Group Chat';
    }
    this.render();
    this.bindEvents();
    this.refreshLedgerDisplay();
  }

  private setupEngineListeners(): void {
    this.engine.onEvent((event: EngineEvent) => {
      switch (event.type) {
        case 'typing':
          this.setAgentThinking(event.agentId, event.isTyping);
          break;
        case 'chunk':
          this.appendAgentChunk(event.agentId, event.deltaText);
          break;
        case 'agent_done':
          this.setAgentThinking(event.agentId, false);
          this.finalizeAgentMessage(event.agentId, event.finalContent);
          break;
        case 'turn_done':
          this.isGenerating = false;
          this.thinkingAgents.clear();
          this.syncAllAvatars();
          this.updateSendButtonState();
          break;
        case 'usage': {
          const agent = this.agents.find((a) => a.id === event.agentId);
          this.ledger.recordUsage(event, agent?.modelName || 'gpt-4o');
          this.refreshLedgerDisplay();
          break;
        }
      }
    });

    this.ledger.setWarningCallback((msg) => {
      const card = this.container.querySelector('.mini-card') as HTMLElement;
      if (card) {
        card.style.borderColor = '#C8402A';
        card.title = msg;
      }
    });
  }

  private render(): void {
    const curLocale = getLocale();
    const otherLocale = curLocale === 'zh-CN' ? 'EN' : '中';
    const currentRoom = this.getCurrentRoom();
    const isPresetRoom = Boolean(currentRoom?.isPreset);

    const roomsHtml = this.rooms
      .map((r) => {
        const isActive = r.id === this.currentRoomId;
        return `
          <div class="room-item-row ${isActive ? 'active' : ''}" data-room="${r.id}">
            <span class="room-name">${r.name}</span>
            <button class="btn-del-room" data-room-del="${r.id}" title="${t('deleteRoom')}">✕</button>
          </div>
        `;
      })
      .join('');

    const cloudAgentsHtml = this.agents
      .filter((a) => a.driverType === 'cloud_api')
      .map((agent) => {
        const isThinking = this.thinkingAgents.has(agent.id);
        const roleDesc = curLocale === 'zh-CN' ? agent.roleZh : agent.roleEn;
        return `
          <div class="item ${isThinking ? 'thinking' : ''}" data-agent="${agent.id}" title="${roleDesc}">
            <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
            ${agent.name}
            ${isThinking ? `<span class="think-tag">${t('statusThinking')}</span>` : `<span class="dot"></span>`}
          </div>
        `;
      })
      .join('');

    const localToolsHtml = `
      <div class="item" data-tool="claude-code">
        <div class="ava a-cli">Cc</div>Claude Code
        ${this.isDesktop ? `<span class="dot"></span>` : `<span class="badge">${t('needsDesktop')}</span>`}
      </div>
      <div class="item" data-tool="comfyui">
        <div class="ava a-cui">Cu</div>ComfyUI
        ${this.isDesktop ? `<span class="dot"></span>` : `<span class="badge">${t('needsDesktop')}</span>`}
      </div>
    `;

    let mainMessagesHtml = '';
    if (!currentRoom) {
      mainMessagesHtml = `
        <div class="empty-hero">
          <div class="icon">💬</div>
          <h3>${t('emptyTitle')}</h3>
          <p>当前无活动对话，请点击左栏「＋ 新建对话」开启。</p>
        </div>
      `;
    } else if (!isPresetRoom) {
      mainMessagesHtml = `
        <div class="empty-hero">
          <div class="icon">✨</div>
          <h3>${currentRoom.name}</h3>
          <p>${t('emptyPlaceholder')}</p>
        </div>
      `;
    } else if (!this.hasLoadedDemo) {
      mainMessagesHtml = `
        <div class="empty-hero">
          <div class="icon">💬</div>
          <h3>${t('emptyTitle')}</h3>
          <p>${t('emptySubtitle')}</p>
          <button class="btn-load-demo" id="btn-load-demo">${t('btnLoadDemo')}</button>
        </div>
      `;
    } else {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">${t('hostLabel')[0]}</div>
          <div>
            <div class="who"><b>${t('hostLabel')}</b></div>
            <div class="bubble">欢迎进入 <b>${currentRoom.name}</b> 演示会诊。</div>
          </div>
        </div>
      `;
    }

    let rightRailContentHtml = '';
    const demoDef = isPresetRoom ? ROOM_DEMO_DEFINITIONS[this.currentRoomId] : undefined;

    if (!currentRoom) {
      rightRailContentHtml = `
        <div class="card">
          <h5>${t('progressTitle')}</h5>
          <div class="empty-st-hint">${t('rightRailProgressEmpty')}</div>
        </div>
      `;
    } else if (demoDef && this.hasLoadedDemo) {
      const stepsHtml = demoDef.steps
        .map((step, idx) => {
          const isActorThinking = step.actorId ? this.thinkingAgents.has(step.actorId) : false;
          const isDoing = step.defaultState === 'doing' || isActorThinking;
          const isDone = step.defaultState === 'done';

          if (isDone) {
            return `<div class="step"><span class="ic">✓</span>${t(step.key)}</div>`;
          } else if (isDoing) {
            return `<div class="step doing"><span class="ic">…</span>${t(step.key)}</div>`;
          } else {
            return `<div class="step wait"><span class="ic">${idx + 1}</span>${t(step.key)}</div>`;
          }
        })
        .join('');

      let membersHtml = '';
      if (demoDef.members) {
        membersHtml = demoDef.members
          .map((m) => {
            const agent = this.agents.find((a) => a.id === m.agentId);
            if (!agent) return '';
            const isThinking = this.thinkingAgents.has(agent.id);
            const statusText = isThinking ? t('statusThinking') : m.defaultStatus === 'spoke' ? t('statusSpoke') : t('statusReady');
            const statusClass = isThinking ? 'st hot' : 'st';

            return `
              <div class="member">
                <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
                <div class="n">${agent.name}</div>
                <div class="${statusClass}">${statusText}</div>
              </div>
            `;
          })
          .join('');
      }

      rightRailContentHtml = `
        <div class="card">
          <h5>${t(demoDef.progressTitleKey)}</h5>
          ${stepsHtml}
        </div>
        ${membersHtml ? `<div class="card"><h5>${t('membersTitle')}</h5>${membersHtml}</div>` : ''}
      `;
    } else {
      const activeAgents = this.agents.filter((a) => currentRoom.activeAgentIds.includes(a.id));
      const membersHtml = activeAgents
        .map((agent) => {
          const isThinking = this.thinkingAgents.has(agent.id);
          const statusText = isThinking ? t('statusThinking') : t('statusReady');
          return `
            <div class="member">
              <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
              <div class="n">${agent.name}</div>
              <div class="st ${isThinking ? 'hot' : ''}">${statusText}</div>
            </div>
          `;
        })
        .join('');

      rightRailContentHtml = `
        <div class="card">
          <h5>${t('progressTitle')}</h5>
          <div class="empty-st-hint" style="color:#7A7368;font-size:12.5px;padding:6px 0;line-height:1.6;">
            ${t('rightRailProgressEmpty')}
          </div>
        </div>
        <div class="card">
          <h5>${t('membersTitle')}</h5>
          ${membersHtml || `<div class="empty-st-hint">${t('noConfiguredAgentsTip')}</div>`}
        </div>
      `;
    }

    const subtitleModeText = this.isBroadcastMode ? t('modeTagBroadcast') : t('modeTagMention');
    const subtitleText = `${subtitleModeText} · ${currentRoom?.name || ''} ${t('presentSuffix')}`;

    this.container.innerHTML = `
      <div class="app-layout">
        <aside class="left-rail">
          <div class="brand">
            <span class="logo">⚡</span>
            <h3>${t('brandTitle')}</h3>
          </div>

          <div class="section-title">${t('roomsTitle')}</div>
          <button class="btn-add-room" id="btn-add-room">${t('addRoom')}</button>
          <div class="room-list">${roomsHtml}</div>

          <div class="section-title" style="margin-top:14px;">${t('cloudAgentsTitle')}</div>
          <div class="agent-list">${cloudAgentsHtml}</div>

          <div class="section-title" style="margin-top:14px;">${t('localToolsTitle')}</div>
          <div class="agent-list">${localToolsHtml}</div>

          <div class="mini-card" id="ledger-card">
            <h5>${t('ledgerTitle')}</h5>
            <div class="r">
              <span>${t('ledgerSession')} <b id="ledger-session-cost">$0.00</b></span>
              <span>${t('ledgerMonthly')} <b id="ledger-monthly-cost">$0.00/$20</b></span>
            </div>
          </div>
        </aside>

        <main class="main-content">
          <header class="top-bar">
            <div>
              <h2 style="font-size:15.5px;font-weight:700;margin:0 0 2px 0;">${currentRoom?.name || t('brandTitle')}</h2>
              <div class="subtitle" style="font-size:11.5px;color:#7A7368;">${subtitleText}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="tb" id="btn-toggle-lang" title="${t('titleToggleLang')}">${otherLocale}</button>
              <button class="tb" id="btn-open-settings" title="${t('titleOpenSettings')}">${t('settings')}</button>
            </div>
          </header>

          <section class="messages-stream" id="messages-stream">
            ${mainMessagesHtml}
          </section>

          <footer class="input-panel" style="position:relative;">
            <div id="mention-popup-container"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <div class="mode-toggles">
                <button class="tb ${this.isBroadcastMode ? 'active' : ''}" id="btn-mode-broadcast">${t('modeAllReply')}</button>
                <button class="tb ${!this.isBroadcastMode ? 'active' : ''}" id="btn-mode-mention">${t('modeMentionOne')}</button>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <textarea class="main-input" id="main-textarea" rows="2" placeholder="${this.isBroadcastMode ? t('inputPlaceholder') : t('inputPlaceholderMention')}"></textarea>
              <button class="send" id="btn-send-message">${t('sendBtn')}</button>
            </div>
          </footer>
        </main>

        <aside class="right-rail">
          ${rightRailContentHtml}
        </aside>
      </div>
    `;
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-toggle-lang')?.addEventListener('click', () => {
      const cur = getLocale();
      setLocale(cur === 'zh-CN' ? 'en-US' : 'zh-CN');
      this.mount();
    });

    this.container.querySelector('#btn-open-settings')?.addEventListener('click', async () => {
      if (this.activeModal) {
        this.activeModal.close();
      }
      this.activeModal = new SettingsModal({
        keyStore: this.keyStore,
        ledger: this.ledger,
        isDesktop: this.isDesktop,
        onClose: () => {
          this.activeModal = null;
        },
        onKeysChanged: () => {
          this.refreshAgentsAfterKeyChange();
        },
      });

      const modalEl = await this.activeModal.render();
      this.activeModal.setMountedElement(modalEl);
      document.body.appendChild(modalEl);
    });

    this.container.querySelector('#btn-load-demo')?.addEventListener('click', () => {
      this.hasLoadedDemo = true;
      this.render();
      this.bindEvents();
    });

    this.container.querySelectorAll('.room-item-row[data-room]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('btn-del-room')) return;
        const roomId = el.getAttribute('data-room');
        if (roomId && roomId !== this.currentRoomId) {
          this.currentRoomId = roomId;
          this.hasLoadedDemo = false;
          this.render();
          this.bindEvents();
        }
      });
    });

    this.container.querySelector('#btn-add-room')?.addEventListener('click', async () => {
      await this.handleCreateNewChat();
    });

    this.container.querySelectorAll<HTMLButtonElement>('.btn-del-room').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.getAttribute('data-room-del');
        if (roomId) {
          this.handleDeleteRoom(roomId);
        }
      });
    });

    this.container.querySelector('#btn-mode-broadcast')?.addEventListener('click', () => {
      this.isBroadcastMode = true;
      this.render();
      this.bindEvents();
    });
    this.container.querySelector('#btn-mode-mention')?.addEventListener('click', () => {
      this.isBroadcastMode = false;
      this.render();
      this.bindEvents();
    });

    const textarea = this.container.querySelector<HTMLTextAreaElement>('#main-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.handleTextareaInput(textarea);
      });
      textarea.addEventListener('keydown', (e) => {
        this.handleTextareaKeydown(e, textarea);
      });
    }

    this.container.querySelector('#btn-send-message')?.addEventListener('click', () => {
      this.handleSendMessage();
    });
  }

  public async handleCreateNewChat(): Promise<void> {
    const defaultName = `${t('defaultNewChatName')} ${this.rooms.length + 1}`;
    let name: string | null = defaultName;

    if (typeof window !== 'undefined' && window.prompt) {
      name = window.prompt(t('newChatPromptName'), defaultName);
      if (!name) return;
    }

    const configuredAgentIds: string[] = [];
    for (const agent of this.agents) {
      if (agent.driverType === 'cloud_api' && agent.provider) {
        const key = await this.keyStore.getKey(agent.provider);
        if (key && key.trim()) {
          configuredAgentIds.push(agent.id);
        }
      }
    }

    const newRoom: CustomRoomMeta = {
      id: `custom-room-${Date.now()}`,
      name: name.trim(),
      isPreset: false,
      activeAgentIds: configuredAgentIds,
    };

    this.rooms.push(newRoom);
    this.saveRooms();
    this.currentRoomId = newRoom.id;
    this.hasLoadedDemo = false;
    this.render();
    this.bindEvents();
  }

  public handleDeleteRoom(roomId: string): void {
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm(t('confirmDeleteRoom'))
      : true;

    if (!confirmed) return;

    this.rooms = this.rooms.filter((r) => r.id !== roomId);
    this.saveRooms();

    if (this.currentRoomId === roomId) {
      this.currentRoomId = this.rooms.length > 0 ? this.rooms[0].id : '';
      this.hasLoadedDemo = false;
    }

    this.render();
    this.bindEvents();
  }

  private handleTextareaInput(textarea: HTMLTextAreaElement): void {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    const mentionMatch = /(?:^|\s)@([^\s]*)$/.exec(textBeforeCursor);

    if (mentionMatch) {
      this.mentionQuery = mentionMatch[1].toLowerCase();
      this.renderMentionPopup(textarea);
    } else {
      this.mentionQuery = null;
      this.hideMentionPopup();
    }
  }

  private handleTextareaKeydown(e: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (this.mentionQuery === null) return;

    const popup = this.container.querySelector('.mention-popup');
    if (!popup) return;

    const items = popup.querySelectorAll<HTMLElement>('.mention-item');
    if (items.length === 0) {
      if (e.key === 'Escape') {
        this.mentionQuery = null;
        this.hideMentionPopup();
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedMentionIndex = (this.selectedMentionIndex + 1) % items.length;
      this.updateMentionSelection(popup);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedMentionIndex = (this.selectedMentionIndex - 1 + items.length) % items.length;
      this.updateMentionSelection(popup);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = items[this.selectedMentionIndex];
      const agentName = selectedItem?.getAttribute('data-mention-name');
      if (agentName) {
        this.applyMention(agentName, textarea);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.mentionQuery = null;
      this.hideMentionPopup();
    }
  }

  private async renderMentionPopup(textarea: HTMLTextAreaElement): Promise<void> {
    const container = this.container.querySelector('#mention-popup-container');
    if (!container) return;

    const currentRoom = this.getCurrentRoom();
    const candidateAgents: ExtendedAgentProfile[] = [];

    for (const agent of this.agents) {
      if (agent.driverType === 'cloud_api' && agent.provider) {
        const key = await this.keyStore.getKey(agent.provider);
        if (key && key.trim()) {
          if (!currentRoom || currentRoom.isPreset || currentRoom.activeAgentIds.includes(agent.id)) {
            candidateAgents.push(agent);
          }
        }
      }
    }

    const filtered = candidateAgents.filter((a) => {
      if (!this.mentionQuery) return true;
      return (
        a.name.toLowerCase().includes(this.mentionQuery) ||
        a.shortName.toLowerCase().includes(this.mentionQuery) ||
        a.provider.toLowerCase().includes(this.mentionQuery)
      );
    });

    if (candidateAgents.length === 0) {
      container.innerHTML = `
        <div class="mention-popup">
          <div class="mention-empty-hint">${t('mentionTipConfigureKey')}</div>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      this.hideMentionPopup();
      return;
    }

    if (this.selectedMentionIndex >= filtered.length) {
      this.selectedMentionIndex = 0;
    }

    const itemsHtml = filtered
      .map((a, idx) => {
        const isSel = idx === this.selectedMentionIndex;
        return `
          <div class="mention-item ${isSel ? 'selected' : ''}" data-mention-name="${a.name}" data-mention-idx="${idx}">
            <div class="ava ${a.avatarClass}">${a.shortName}</div>
            <span class="name">${a.name}</span>
            <span class="provider">(${a.provider})</span>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="mention-popup">
        <div class="mh">${t('mentionHeader')}</div>
        ${itemsHtml}
      </div>
    `;

    container.querySelectorAll<HTMLElement>('.mention-item').forEach((item) => {
      item.addEventListener('click', () => {
        const aName = item.getAttribute('data-mention-name');
        if (aName) {
          this.applyMention(aName, textarea);
        }
      });
    });
  }

  private updateMentionSelection(popup: Element): void {
    const items = popup.querySelectorAll<HTMLElement>('.mention-item');
    items.forEach((it, idx) => {
      if (idx === this.selectedMentionIndex) {
        it.classList.add('selected');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('selected');
      }
    });
  }

  private applyMention(agentName: string, textarea: HTMLTextAreaElement): void {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);

    const replacedBefore = textBeforeCursor.replace(/(?:^|\s)@([^\s]*)$/, (match) => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}@${agentName} `;
    });

    textarea.value = replacedBefore + textAfterCursor;
    textarea.focus();
    const newPos = replacedBefore.length;
    textarea.setSelectionRange(newPos, newPos);

    this.mentionQuery = null;
    this.hideMentionPopup();
  }

  private hideMentionPopup(): void {
    const container = this.container.querySelector('#mention-popup-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  private async refreshAgentsAfterKeyChange(): Promise<void> {
    this.render();
    this.bindEvents();
  }

  private setAgentThinking(agentId: string, isThinking: boolean): void {
    if (isThinking) {
      this.thinkingAgents.add(agentId);
    } else {
      this.thinkingAgents.delete(agentId);
    }
    this.syncAllAvatars();
  }

  private syncAllAvatars(): void {
    this.agents.forEach((agent) => {
      const itemEl = this.container.querySelector(`.item[data-agent="${agent.id}"]`);
      if (itemEl) {
        const isThinking = this.thinkingAgents.has(agent.id);
        if (isThinking) {
          itemEl.classList.add('thinking');
        } else {
          itemEl.classList.remove('thinking');
        }
      }
    });
  }

  private appendAgentChunk(agentId: string, delta: string): void {}
  private finalizeAgentMessage(agentId: string, content: string): void {}

  private updateSendButtonState(): void {
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btn-send-message');
    if (sendBtn) {
      sendBtn.disabled = this.isGenerating;
      sendBtn.textContent = this.isGenerating ? t('sendingBtn') : t('sendBtn');
    }
  }

  private handleSendMessage(): void {
    const textarea = this.container.querySelector<HTMLTextAreaElement>('#main-textarea');
    if (!textarea || !textarea.value.trim() || this.isGenerating) return;

    const content = textarea.value.trim();
    textarea.value = '';
    this.hideMentionPopup();

    const stream = this.container.querySelector('#messages-stream');
    if (stream) {
      const userBubble = document.createElement('div');
      userBubble.className = 'msg user';
      userBubble.innerHTML = `
        <div class="who"><b>${t('you')}</b></div>
        <div class="bubble">${content}</div>
      `;
      stream.appendChild(userBubble);
      stream.scrollTop = stream.scrollHeight;
    }
  }

  public refreshLedgerDisplay(): void {
    const sessionSummary = this.ledger.getSessionSummary(this.session.id);
    const monthlySummary = this.ledger.getMonthlySummary();
    const limits = this.ledger.getLimits();

    const sCostEl = this.container.querySelector('#ledger-session-cost');
    const mCostEl = this.container.querySelector('#ledger-monthly-cost');

    if (sCostEl) {
      sCostEl.textContent = `$${sessionSummary.costUsd.toFixed(2)}`;
    }
    if (mCostEl) {
      mCostEl.textContent = `$${monthlySummary.costUsd.toFixed(2)}/$${limits.monthlyLimitUsd}`;
    }
  }
}
