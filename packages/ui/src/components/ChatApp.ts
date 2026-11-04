/**
 * @take/ui - ChatApp.ts
 * TakeChat 核心主界面（工单 16 演示状态同源收尾终版）
 * 核心优化：
 * 1. 通用会诊室两卡一致：四间会诊室载入演示后，进行中步骤与成员卡状态严格同源；
 * 2. 右栏状态单一数据源：ROOM_DEMO_DEFINITIONS 数据结构统一驱动每间房的步骤与成员卡渲染；
 * 3. 分镜房自洽：维持样张 B（进度＋分镜汇总表定版），进度卡内状态自洽；
 * 4. 账本刷新格式对齐：refreshLedgerDisplay 输出与初始渲染完全一致（无斜杠空格），外层 span 补 flex-shrink:0 加固防裁切。
 */

import { ContextEngine, Session, Message, AgentProfile, EngineEvent, LocalLedger, StoryboardManager, ShotCard } from '@take/engine';
import { BrowserKeyStore, DesktopKeyStore, KeyStore, ComfyUiAdapter, ComfyExecutionResult } from '@take/adapters';
import { t, getLocale, setLocale, Locale, TranslationDict } from '../i18n/index.js';
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

/**
 * 房间演示状态规格定义（工单 16 单一数据源）
 */
export interface DemoStepDefinition {
  key: keyof TranslationDict;
  actorId?: string; // 关联的智能体 ID 或角色标识 ('Cl' | 'Gr' | 'Gp' | 'Ds' | 'User' | 'Host' | 'Adapter' | 'All')
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
    // 样张 B 定版：分镜房右栏为进度卡＋分镜整表汇总，无成员卡
  },
};

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

    // 分镜卡种子数据：严格无 127.0.0.1 坏链
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

    // 联系人体系（含 roleZh / roleEn 专有角色说明）
    this.agents = [
      { id: 'Cl', name: 'Claude', shortName: 'Cl', avatarClass: 'a-claude', roleZh: '写提示词 · 提示词专家', roleEn: 'Prompts · Prompt Expert', systemPrompt: '写提示词 · 提示词专家', provider: 'anthropic', modelName: 'claude-3-7-sonnet', driverType: 'cloud_api', status: 'spoke' },
      { id: 'Gp', name: 'ChatGPT', shortName: 'Gp', avatarClass: 'a-gpt', roleZh: '出分镜图 · 分镜师', roleEn: 'Storyboards · Storyboard Artist', systemPrompt: '出分镜图 · 分镜师', provider: 'openai', modelName: 'gpt-4o', driverType: 'cloud_api', status: 'spoke' },
      { id: 'Ge', name: 'Gemini', shortName: 'Ge', avatarClass: 'a-gem', roleZh: '查资料 · 知识检索', roleEn: 'Research · Knowledge Retrieval', systemPrompt: '查资料 · 知识检索', provider: 'google', modelName: 'gemini-2-0-flash', driverType: 'cloud_api', status: 'ready' },
      { id: 'Ds', name: 'DeepSeek', shortName: 'DS', avatarClass: 'a-ds', roleZh: '写代码 · 技术推理', roleEn: 'Coding · Technical Reasoning', systemPrompt: '写代码 · 技术推理', provider: 'deepseek', modelName: 'deepseek-reasoner', driverType: 'cloud_api', status: 'thinking' },
      { id: 'Gr', name: 'Grok Bot', shortName: 'Gr', avatarClass: 'a-grok', roleZh: '搭工作流 · 工作流专家', roleEn: 'Workflow · Pipeline Specialist', systemPrompt: '搭工作流 · 工作流专家', provider: 'xai', modelName: 'grok-2', driverType: 'cloud_api', status: 'ready' },
      { id: 'Cc', name: 'Claude Code', shortName: 'Cc', avatarClass: 'a-cli', roleZh: '本地编程 · ACP 架构', roleEn: 'Local Coding · ACP Stdio', systemPrompt: '本地编程 · ACP 架构', provider: 'local-cli', modelName: 'claude-code-acp', driverType: 'local_acp', status: 'ready' },
    ];

    this.session = {
      id: 'session-rainynight',
      roomId: 'prompt-clinic',
      title: '短片《雨夜》制作会诊',
      history: [],
      activeAgentIds: ['Cl', 'Gp', 'Ge', 'Ds', 'Gr'],
      tokenBudget: 50000,
      totalTokensUsed: 0,
      isClosed: false,
    };

    this.setupEngineListeners();
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

  private syncDemoThinkingState(): void {
    this.thinkingAgents.clear();
    const demoDef = ROOM_DEMO_DEFINITIONS[this.currentRoomId];
    const doingStep = demoDef?.steps.find((s) => s.defaultState === 'doing');
    if (doingStep?.actorId && this.agents.some((a) => a.id === doingStep.actorId)) {
      this.thinkingAgents.add(doingStep.actorId);
    }
  }

  private render(): void {
    const curLocale = getLocale();
    const otherLocale = curLocale === 'zh-CN' ? 'EN' : '中';

    let roomTitle = t('promptClinic');
    if (this.currentRoomId === 'comfyui-fix') {
      roomTitle = t('comfyFix');
    } else if (this.currentRoomId === 'storyboard-clinic') {
      roomTitle = t('storyboardClinic');
    } else if (this.currentRoomId === 'general-clinic') {
      roomTitle = t('generalClinic');
    }

    // 1. 左栏云端助手列表（只认真实 thinking 集合）
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

    // 2. 左栏本地工具列表：单徽章收口
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

    // 3. 分镜表汇总表格（状态列列头纠正为走 t('shotStatusHeader')）
    const shots = this.storyboard.getStoryboardSummary();
    const sbTableRows = shots
      .map((s) => {
        let statusBadge = `<span class="badge" style="background:#F5E9C8;color:#8A6D1F;">${t('shotStatusPending')}</span>`;
        if (s.status === 'rendered') {
          statusBadge = `<span class="badge" style="background:#E1F5FE;color:#0277BD;">${t('shotStatusRendered')}</span>`;
        } else if (s.status === 'finalized') {
          statusBadge = `<span class="badge" style="background:#E8F5E9;color:#2E7D32;">${t('shotStatusFinalized')}</span>`;
        }
        return `
          <tr>
            <td style="font-weight:700;">#${s.shotNumber}</td>
            <td>${s.shotScale}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join('');

    // 4. 分镜卡渲染
    const renderShotCardHtml = (shot: ShotCard) => {
      let badgeClass = 'pending';
      let badgeText = t('shotStatusPending');
      if (shot.status === 'rendered') {
        badgeClass = 'rendered';
        badgeText = t('shotStatusRendered');
      } else if (shot.status === 'finalized') {
        badgeClass = 'finalized';
        badgeText = t('shotStatusFinalized');
      }

      const imgHtml = shot.imageUrl
        ? `<div class="img-preview"><img src="${shot.imageUrl}" alt="${t('shotCardTitle')} #${shot.shotNumber} ${t('shotAltText')}" /></div>`
        : `<div class="img-placeholder">📷 [${t('needsDesktop')} · ${t('shotStatusPending')}]</div>`;

      return `
        <div class="shot-card" data-shot="${shot.shotNumber}">
          <div class="head">
            <span class="t">${t('shotCardTitle')} #${shot.shotNumber} · ${shot.shotScale}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="desc">${shot.visualContent}</div>
          <div class="pbox">${shot.prompt}</div>
          ${imgHtml}
          <div class="actions">
            <button class="shot-btn btn-render-shot" data-shot="${shot.shotNumber}">${t('btnRenderShot')}</button>
            <button class="shot-btn primary btn-finalize-shot" data-shot="${shot.shotNumber}">${t('btnFinalizeShot')}</button>
          </div>
        </div>
      `;
    };

    // 5. 主消息区内容：默认首屏为空态，按需载入演示会诊
    let mainMessagesHtml = '';
    if (!this.hasLoadedDemo) {
      // 干净空态
      mainMessagesHtml = `
        <div class="empty-hero">
          <div class="icon">💬</div>
          <h3>${t('emptyTitle')}</h3>
          <p>${t('emptySubtitle')}</p>
          <button class="btn-load-demo" id="btn-load-demo">${t('btnLoadDemo')}</button>
        </div>
      `;
    } else if (this.currentRoomId === 'storyboard-clinic') {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">${t('hostLabel')[0]}</div>
          <div>
            <div class="who"><b>${t('hostLabel')}</b> 10:00</div>
            <div class="bubble">欢迎进入 <b>分镜与镜头会诊室</b>。本轮流程：ChatGPT 规划分镜结构、Claude 精炼镜头英文提示词、DeepSeek 调整参数，Grok Bot 调度 ComfyUI 生成样片并汇总成表。</div>
          </div>
        </div>

        <div class="msg" data-msg-agent="Gp">
          <div class="ava a-gpt lg">Gp</div>
          <div>
            <div class="who"><b>ChatGPT</b> · ${curLocale === 'zh-CN' ? '分镜师' : 'Storyboard Artist'}</div>
            <div class="bubble">
              分镜大纲已理清，雨夜便利店的三连镜结构如下：
              ${renderShotCardHtml(shots[0])}
              ${renderShotCardHtml(shots[1])}
              ${renderShotCardHtml(shots[2])}
            </div>
          </div>
        </div>
      `;
    } else if (this.currentRoomId === 'comfyui-fix') {
      mainMessagesHtml = `
        <div class="comfy-action-bar" style="background:#FFFDF8;border:1px solid #E3DCCB;border-radius:11px;padding:11px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:12.5px;color:#1C1A17;">
            🎨 <b>${t('comfyWorkbenchTitle')}</b>: ${t('comfyWorkbenchDesc')}
          </div>
          <button class="send" id="btn-submit-workflow" style="padding:6px 14px;font-size:12px;border-radius:8px;">
            ${t('comfySubmitWorkflow')}
            ${!this.isDesktop ? `<span style="font-size:10px;margin-left:4px;opacity:0.9;">(${t('needsDesktop')})</span>` : ''}
          </button>
        </div>
        <div class="msg host">
          <div class="ava a-host lg">${t('hostLabel')[0]}</div>
          <div>
            <div class="who"><b>${t('hostLabel')}</b> 09:40</div>
            <div class="bubble">这里是 <b>ComfyUI 报错会诊室</b>。请提交出问题的工作流，系统将自动为你生成结构化报错会诊单。</div>
          </div>
        </div>
        <div class="msg" data-msg-agent="Gr">
          <div class="ava a-grok lg">Gr</div>
          <div>
            <div class="who"><b>Grok Bot</b> 09:41</div>
            <div class="bubble">已捕获本地工作流 KSampler 异常。正在提取节点 4 错误参数并准备排查。</div>
          </div>
        </div>
      `;
    } else if (this.currentRoomId === 'general-clinic') {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">${t('hostLabel')[0]}</div>
          <div>
            <div class="who"><b>${t('hostLabel')}</b> 09:30</div>
            <div class="bubble">欢迎来到 <b>通用会诊室</b>。支持针对多任务架构、算法推演与综合课题展开跨模型头脑风暴。</div>
          </div>
        </div>
        <div class="msg" data-msg-agent="Cl">
          <div class="ava a-claude lg">Cl</div>
          <div>
            <div class="who"><b>Claude</b> 09:31</div>
            <div class="bubble">已就位，支持梳理顶层框架与逻辑大纲。</div>
          </div>
        </div>
      `;
    } else {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">${t('hostLabel')[0]}</div>
          <div>
            <div class="who"><b>${t('hostLabel')}</b> 09:41</div>
            <div class="bubble">本轮目标：为《雨夜》出一条可直接跑的视频提示词、一套 ComfyUI 工作流和三格分镜。Claude 先给提示词。</div>
          </div>
        </div>

        <div class="msg" data-msg-agent="Cl">
          <div class="ava a-claude lg">Cl</div>
          <div>
            <div class="who"><b>Claude</b> 09:42</div>
            <div class="bubble">提示词好了：「深夜便利店，雨幕中的霓虹倒影，女主角撑伞走过镜头，浅景深，胶片颗粒，冷色调」。要点在倒影和颗粒，别堆形容词。</div>
          </div>
        </div>

        <div class="msg" data-msg-agent="Gp">
          <div class="ava a-gpt lg">Gp</div>
          <div>
            <div class="who"><b>ChatGPT</b> 09:44</div>
            <div class="bubble">
              分镜三格：建立镜头、过肩、特写。
              <div class="frames">
                <div class="frame">① 建立 · 雨夜街道</div>
                <div class="frame">② 过肩 · 伞下侧脸</div>
                <div class="frame">③ 特写 · 霓虹倒影</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 副标题人话化展示
    const subtitleModeText = this.isBroadcastMode ? t('modeTagBroadcast') : t('modeTagMention');
    const subtitleText = `${subtitleModeText} · Claude, ChatGPT, Gemini, DeepSeek, Grok Bot ${t('presentSuffix')}`;

    // 6. 右栏内容：根据当前房间统一以 ROOM_DEMO_DEFINITIONS 单一源驱动渲染
    let rightRailContentHtml = '';
    if (!this.hasLoadedDemo) {
      rightRailContentHtml = `
        <div class="card">
          <h5>${t('progressTitle')}</h5>
          <div class="empty-st-hint" style="color:#7A7368;font-size:12.5px;padding:6px 0;line-height:1.6;">
            ${t('rightRailProgressEmpty')}
          </div>
        </div>
        <div class="card">
          <h5>${t('membersTitle')}</h5>
          <div class="empty-st-hint" style="color:#7A7368;font-size:12.5px;padding:6px 0;line-height:1.6;">
            ${t('rightRailMembersEmpty')}
          </div>
        </div>
      `;
    } else {
      // 演示已载入：根据当前房间配置单一源驱动
      const demoDef = ROOM_DEMO_DEFINITIONS[this.currentRoomId] || ROOM_DEMO_DEFINITIONS['prompt-clinic'];

      // 渲染阶段进度步骤
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

      let secondCardHtml = '';
      if (this.currentRoomId === 'storyboard-clinic') {
        // 分镜房第二张卡为分镜整表汇总（样张 B 定版）
        secondCardHtml = `
          <div class="card">
            <h5>${t('storyboardTableTitle')}</h5>
            <table class="sb-table">
              <thead>
                <tr><th>${t('shotCardTitle')}</th><th>${t('shotScaleLabel')}</th><th>${t('shotStatusHeader')}</th></tr>
              </thead>
              <tbody id="sb-table-body">
                ${sbTableRows}
              </tbody>
            </table>
          </div>
        `;
      } else if (demoDef.members && demoDef.members.length > 0) {
        // 其余会诊室由 demoDef.members 单一源驱动成员状态渲染，两卡严格同源
        const membersHtml = demoDef.members
          .map((m) => {
            const agent = this.agents.find((a) => a.id === m.agentId);
            if (!agent) return '';

            const isThinking = this.thinkingAgents.has(m.agentId);
            let statusText = t('statusReady');
            let statusClass = 'st';

            if (isThinking) {
              statusText = t('statusThinking');
              statusClass = 'st hot';
            } else if (m.defaultStatus === 'spoke') {
              statusText = t('statusSpoke');
              statusClass = 'st';
            }

            return `
              <div class="mrow" data-member="${agent.id}">
                <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
                ${agent.name}
                <span class="${statusClass}">${statusText}</span>
              </div>
            `;
          })
          .join('');

        secondCardHtml = `
          <div class="card">
            <h5>${t('membersTitle')}</h5>
            ${membersHtml}
          </div>
        `;
      }

      rightRailContentHtml = `
        <div class="card">
          <h5>${t(demoDef.progressTitleKey)}</h5>
          ${stepsHtml}
        </div>
        ${secondCardHtml}
      `;
    }

    // 输入框占位符根据模式切换动态联动
    const currentInputPlaceholder = this.isBroadcastMode ? t('inputPlaceholder') : t('inputPlaceholderMention');

    this.container.innerHTML = `
      <div class="app">
        <!-- 顶栏：54px -->
        <div class="topbar">
          <div class="logo">Take<span>Chat</span></div>
          <div class="rt" id="topbar-room-name">${roomTitle}</div>
          <div class="sp"></div>
          <button class="tbtn" id="btn-lang" title="${t('titleToggleLang')}">${otherLocale}</button>
          <button class="tbtn" id="btn-settings" title="${t('titleOpenSettings')}">⚙</button>
        </div>

        <!-- 主体：三栏并排，高度 600px -->
        <div class="body">
          <!-- 左栏：212px 索引式 -->
          <aside class="rail">
            <h4>${t('roomsTitle')}</h4>
            <div class="item ${this.currentRoomId === 'prompt-clinic' ? 'on' : ''}" data-room="prompt-clinic">${t('promptClinic')}</div>
            <div class="item ${this.currentRoomId === 'general-clinic' ? 'on' : ''}" data-room="general-clinic">${t('generalClinic')}</div>
            <div class="item ${this.currentRoomId === 'comfyui-fix' ? 'on' : ''}" data-room="comfyui-fix">
              ${t('comfyFix')} <span class="err-n">1</span>
            </div>
            <div class="item ${this.currentRoomId === 'storyboard-clinic' ? 'on' : ''}" data-room="storyboard-clinic">
              ${t('storyboardClinic')} <span class="badge" style="background:#E1F5FE;color:#0277BD;">${t('badgeNew')}</span>
            </div>

            <h4>${t('cloudAgentsTitle')}</h4>
            ${cloudAgentsHtml}

            <h4>${t('localToolsTitle')}</h4>
            ${localToolsHtml}

            <div class="grow"></div>

            <!-- 左下角账本小卡：标题与摘要行防折行不裁切，金额永不截断 -->
            <div class="mini-card">
              <h5>
                <span>${t('ledgerTitle')}</span>
                <span style="font-size:10px;color:#7A7368;">${t('ledgerSummaryLabel')}</span>
              </h5>
              <div class="r">
                <span>${t('ledgerSession')} <b id="ledger-session-cost">$0.00</b></span>
                <span>${t('ledgerMonthly')} <b id="ledger-monthly-cost">$0.00/$20</b></span>
              </div>
              <div class="lbar"><i id="ledger-monthly-bar" style="width:2%"></i></div>
            </div>
          </aside>

          <!-- 主区：聊天 -->
          <section class="main">
            <div class="chat-head">
              <div class="t" id="chat-title">${roomTitle}</div>
              <div class="s" id="chat-subtitle">${subtitleText}</div>
            </div>

            <div class="msgs" id="msg-stream">
              ${mainMessagesHtml}
            </div>

            <div class="composer">
              <span class="mode-toggle" id="btn-mode-toggle">${this.isBroadcastMode ? t('modeAllReply') : t('modeMentionOne')}</span>
              <input class="box" id="chat-input" placeholder="${currentInputPlaceholder}" />
              <button class="send" id="btn-send">${t('sendBtn')}</button>
            </div>
          </section>

          <!-- 右栏：272px 进度与状态双卡（随房间独立联动） -->
          <aside class="right">
            ${rightRailContentHtml}
          </aside>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const inputEl = this.container.querySelector('#chat-input') as HTMLInputElement;
    const sendBtn = this.container.querySelector('#btn-send') as HTMLButtonElement;
    const modeBtn = this.container.querySelector('#btn-mode-toggle') as HTMLElement;
    const langBtn = this.container.querySelector('#btn-lang') as HTMLButtonElement;
    const settingsBtn = this.container.querySelector('#btn-settings') as HTMLElement;
    const loadDemoBtn = this.container.querySelector('#btn-load-demo') as HTMLButtonElement;

    // 载入演示数据按钮：按单一源同源激活对应房间的工作中状态（四间房自洽对齐）
    loadDemoBtn?.addEventListener('click', () => {
      this.hasLoadedDemo = true;
      this.syncDemoThinkingState();
      this.render();
      this.bindEvents();
      this.refreshLedgerDisplay();
    });

    // 房间切换事件：随房间切换独立隔离状态，房与房不串状态
    this.container.querySelectorAll('.rail .item[data-room]').forEach((roomEl) => {
      roomEl.addEventListener('click', () => {
        const roomId = roomEl.getAttribute('data-room');
        if (roomId && roomId !== this.currentRoomId) {
          this.currentRoomId = roomId;
          // 若已载入演示，切换房间时同步切换该房间同源思考状态
          if (this.hasLoadedDemo) {
            this.syncDemoThinkingState();
          }
          this.render();
          this.bindEvents();
          this.refreshLedgerDisplay();
        }
      });
    });

    // 本地工具点击降级提示（导向化文案）
    this.container.querySelectorAll('.rail .item[data-tool]').forEach((toolEl) => {
      toolEl.addEventListener('click', () => {
        if (!this.isDesktop) {
          alert(t('needsDesktopNotice'));
        }
      });
    });

    // 分镜卡动作：ComfyUI 出图与定稿
    this.container.querySelectorAll<HTMLButtonElement>('.btn-render-shot').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const shotNum = parseInt(btn.getAttribute('data-shot') || '0', 10);
        if (!shotNum) return;

        if (!this.isDesktop) {
          alert(t('needsDesktopNotice'));
          return;
        }

        btn.disabled = true;
        btn.textContent = t('renderingShot');
        try {
          const adapter = new ComfyUiAdapter();
          const shot = this.storyboard.getShot(shotNum);
          const promptId = await adapter.queuePrompt({
            '3': { class_type: 'KSampler', inputs: { seed: 1000 + shotNum, steps: 25, cfg: 7.0 } },
          });
          const result: ComfyExecutionResult = await adapter.pollHistory(promptId, 30);
          if (result.success && result.imageUrls.length > 0) {
            this.storyboard.attachRenderedImage(shotNum, result.imageUrls[0], 'Grok Bot');
            this.render();
            this.bindEvents();
          } else {
            alert(`${t('renderFailed')}: ${result.rawError || t('unknownError')}`);
            btn.disabled = false;
            btn.textContent = t('btnRenderShot');
          }
        } catch (err) {
          alert(`${t('renderError')}: ${err instanceof Error ? err.message : String(err)}`);
          btn.disabled = false;
          btn.textContent = t('btnRenderShot');
        }
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('.btn-finalize-shot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shotNum = parseInt(btn.getAttribute('data-shot') || '0', 10);
        if (shotNum) {
          this.storyboard.finalizeShot(shotNum, 'User');
          this.render();
          this.bindEvents();
        }
      });
    });

    // 设置弹窗
    settingsBtn?.addEventListener('click', async () => {
      if (this.activeModal) return;
      this.activeModal = new SettingsModal({
        keyStore: this.keyStore,
        ledger: this.ledger,
        isDesktop: this.isDesktop,
        onClose: () => {
          this.activeModal = null;
          this.refreshLedgerDisplay();
        },
      });
      const modalEl = await this.activeModal.render();
      document.body.appendChild(modalEl);
    });

    // 切换语言
    langBtn?.addEventListener('click', () => {
      const nextLocale: Locale = getLocale() === 'zh-CN' ? 'en-US' : 'zh-CN';
      setLocale(nextLocale);
      if (typeof document !== 'undefined') {
        document.title = nextLocale === 'zh-CN' ? 'TakeChat · 多智能体协作群聊' : 'TakeChat · Multi-Agent Group Chat';
      }
      this.render();
      this.bindEvents();
      this.refreshLedgerDisplay();
    });

    // 模式切换与占位符动态联动
    modeBtn?.addEventListener('click', () => {
      this.isBroadcastMode = !this.isBroadcastMode;
      modeBtn.textContent = this.isBroadcastMode ? t('modeAllReply') : t('modeMentionOne');
      modeBtn.style.color = this.isBroadcastMode ? '#C8402A' : '#57524A';
      modeBtn.style.borderColor = this.isBroadcastMode ? '#C8402A' : '#E3DCCB';
      const chatSub = this.container.querySelector('#chat-subtitle');
      if (chatSub) {
        const subtitleModeText = this.isBroadcastMode ? t('modeTagBroadcast') : t('modeTagMention');
        chatSub.textContent = `${subtitleModeText} · Claude, ChatGPT, Gemini, DeepSeek, Grok Bot ${t('presentSuffix')}`;
      }
      if (inputEl) {
        inputEl.placeholder = this.isBroadcastMode ? t('inputPlaceholder') : t('inputPlaceholderMention');
      }
    });

    // 发送消息
    const handleSend = () => {
      const text = inputEl.value.trim();
      if (!text || this.isGenerating) return;
      this.hasLoadedDemo = true;
      inputEl.value = '';
      this.triggerTurn(text);
    };

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    // 联系人点击思考态演示
    this.container.querySelectorAll('.rail .item[data-agent]').forEach((el) => {
      el.addEventListener('click', () => {
        const agentId = el.getAttribute('data-agent');
        if (agentId) {
          const isThinking = !this.thinkingAgents.has(agentId);
          this.setAgentThinking(agentId, isThinking);
        }
      });
    });
  }

  private async triggerTurn(prompt: string): Promise<void> {
    this.isGenerating = true;
    this.updateSendButtonState();

    const stream = this.container.querySelector('#msg-stream') as HTMLElement;
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'msg me';
    userMsgEl.innerHTML = `
      <div class="ava a-user lg">${t('you')}</div>
      <div>
        <div class="who"><b>${t('you')}</b></div>
        <div class="bubble">${prompt}</div>
      </div>
    `;
    stream.appendChild(userMsgEl);
    stream.scrollTop = stream.scrollHeight;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sessionId: this.session.id,
      turnIndex: (this.session.history[this.session.history.length - 1]?.turnIndex ?? 0) + 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: t('you'),
      content: prompt,
      createdAt: Date.now(),
    };

    const mode = this.isBroadcastMode ? 'broadcast' : 'mention';
    const { turnIndex, targetAgentIds } = this.engine.initTurn(this.session, userMsg, mode);

    const completedTurnInsights = new Map<string, { agentName: string; content: string }>();

    for (const agentId of targetAgentIds) {
      const agent = this.agents.find((a) => a.id === agentId);
      if (!agent) continue;

      if (agent.driverType === 'local_acp' && !this.isDesktop) continue;

      this.engine.notifyTyping(this.session.id, turnIndex, agentId, true);

      const agentMsgEl = document.createElement('div');
      agentMsgEl.className = 'msg';
      agentMsgEl.setAttribute('data-msg-agent', agentId);
      agentMsgEl.innerHTML = `
        <div class="ava ${agent.avatarClass} lg think" data-av="${agentId}">${agent.shortName}</div>
        <div>
          <div class="who"><b>${agent.name}</b> · ${getLocale() === 'zh-CN' ? agent.roleZh : agent.roleEn} <span class="thinklbl">${t('statusThinking')}…</span></div>
          <div class="bubble" id="bub-${agentId}-${turnIndex}"></div>
        </div>
      `;
      stream.appendChild(agentMsgEl);
      stream.scrollTop = stream.scrollHeight;

      const assembledPayload = this.engine.assembleForAgent(
        agent,
        this.session.history,
        prompt,
        completedTurnInsights
      );

      await new Promise((r) => setTimeout(r, 450));
      const simulatedText = getLocale() === 'zh-CN'
        ? `针对「${prompt.slice(0, 15)}...」，已基于前序讨论完成处理方案输出。`
        : `Regarding "${prompt.slice(0, 15)}...", processing plan output has been generated based on prior discussion.`;
      for (let i = 0; i < simulatedText.length; i += 3) {
        const chunk = simulatedText.slice(i, i + 3);
        this.engine.notifyChunk(this.session.id, turnIndex, agentId, chunk);
        await new Promise((r) => setTimeout(r, 40));
      }

      completedTurnInsights.set(agentId, { agentName: agent.name, content: simulatedText });
      this.engine.notifyAgentDone(
        this.session.id,
        turnIndex,
        agentId,
        simulatedText,
        assembledPayload.length * 40,
        120
      );
    }

    this.engine.notifyTurnDone(this.session.id, turnIndex, targetAgentIds, 400);
  }

  private setAgentThinking(agentId: string, isThinking: boolean): void {
    if (isThinking) {
      this.thinkingAgents.add(agentId);
    } else {
      this.thinkingAgents.delete(agentId);
    }

    // 同步左栏紧凑行
    const railItem = this.container.querySelector(`.rail .item[data-agent="${agentId}"]`);
    if (railItem) {
      railItem.classList.toggle('thinking', isThinking);
      const tag = railItem.querySelector('.think-tag');
      const dot = railItem.querySelector('.dot');
      if (isThinking) {
        if (!tag) {
          if (dot) dot.remove();
          const newTag = document.createElement('span');
          newTag.className = 'think-tag';
          newTag.textContent = t('statusThinking');
          railItem.appendChild(newTag);
        }
      } else {
        if (tag) tag.remove();
        if (!dot) {
          const newDot = document.createElement('span');
          newDot.className = 'dot';
          railItem.appendChild(newDot);
        }
      }
    }

    // 同步右栏成员状态行（按同源单一源同步）
    const memberRow = this.container.querySelector(`.right .mrow[data-member="${agentId}"]`);
    if (memberRow) {
      const stEl = memberRow.querySelector('.st');
      if (stEl) {
        if (isThinking) {
          stEl.className = 'st hot';
          stEl.textContent = t('statusThinking');
        } else {
          stEl.className = 'st';
          stEl.textContent = t('statusReady');
        }
      }
    }

    // 同步主消息区头像思考态
    this.container.querySelectorAll(`.msgs [data-av="${agentId}"]`).forEach((el) => {
      el.classList.toggle('think', isThinking);
    });
  }

  private appendAgentChunk(agentId: string, text: string): void {
    const stream = this.container.querySelector('#msg-stream') as HTMLElement;
    const bub = this.container.querySelector(`[data-msg-agent="${agentId}"]:last-of-type .bubble`);
    if (bub) {
      bub.textContent += text;
      stream.scrollTop = stream.scrollHeight;
    }
  }

  private finalizeAgentMessage(agentId: string, finalContent: string): void {
    const msgEl = this.container.querySelector(`[data-msg-agent="${agentId}"]:last-of-type`);
    if (msgEl) {
      const thinkLabel = msgEl.querySelector('.thinklbl');
      if (thinkLabel) thinkLabel.remove();
      const bub = msgEl.querySelector('.bubble');
      if (bub) bub.textContent = finalContent;
    }
  }

  private syncAllAvatars(): void {
    this.container.querySelectorAll('.ava').forEach((el) => {
      el.classList.remove('think');
    });
  }

  private updateSendButtonState(): void {
    const sendBtn = this.container.querySelector('#btn-send') as HTMLButtonElement;
    if (sendBtn) {
      sendBtn.disabled = this.isGenerating;
      sendBtn.textContent = this.isGenerating ? t('sendingBtn') : t('sendBtn');
    }
  }

  private refreshLedgerDisplay(): void {
    const sSummary = this.ledger.getSessionSummary(this.session.id);
    const mSummary = this.ledger.getMonthlySummary();
    const limits = this.ledger.getLimits();

    const sCostEl = this.container.querySelector('#ledger-session-cost');
    const mCostEl = this.container.querySelector('#ledger-monthly-cost');
    const mBarEl = this.container.querySelector('#ledger-monthly-bar') as HTMLElement;

    if (sCostEl) {
      sCostEl.textContent = `$${sSummary.costUsd.toFixed(2)}`;
    }
    if (mCostEl) {
      mCostEl.textContent = `$${mSummary.costUsd.toFixed(2)}/$${limits.monthlyLimitUsd}`;
    }
    if (mBarEl) {
      const percent = Math.min(100, Math.max(2, (mSummary.costUsd / limits.monthlyLimitUsd) * 100));
      mBarEl.style.width = `${percent}%`;
    }
  }
}
