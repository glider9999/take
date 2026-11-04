/**
 * @take/ui - ChatApp.ts (工单 11 分镜与镜头会诊室＋双版对齐终版)
 * 特性：
 * 1. 补齐第四间官方预设「分镜与镜头会诊室」；
 * 2. 结构化分镜卡（ShotCard）：镜号、景别、提示词、状态（待定/已出图/已定稿）流式卡片渲染；
 * 3. 分镜表汇总：右栏实时展示全量分镜汇总表格；
 * 4. 出图挂钩与双版对齐：桌面端一键调用 ComfyUI 生成样片并回贴更新，浏览器版标准友好阻断降级；
 * 5. 完整保留 v4 样张 B 三栏排布、朱红弧光微摆动效与本地用量账本。
 */

import { ContextEngine, Session, Message, AgentProfile, EngineEvent, LocalLedger, StoryboardManager, ShotCard } from '@take/engine';
import { BrowserKeyStore, DesktopKeyStore, KeyStore, ComfyUiAdapter, ComfyExecutionResult } from '@take/adapters';
import { t, getLocale, setLocale, Locale } from '../i18n/index.js';
import { SettingsModal } from './SettingsModal.js';

export interface ChatAppOptions {
  container: HTMLElement;
  isDesktop?: boolean;
}

export interface ExtendedAgentProfile extends AgentProfile {
  shortName: string;
  avatarClass: string;
  driverType?: 'cloud_api' | 'local_acp' | 'local_pty';
  status: 'spoke' | 'ready' | 'thinking' | 'no_key';
}

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

    // 初始化分镜管理器
    this.storyboard = new StoryboardManager([
      {
        shotNumber: 1,
        shotScale: '全景',
        visualContent: '深夜便利店外景，女孩撑伞走过水洼，霓虹倒影闪烁',
        prompt: 'cinematic wide shot, convenience store at night, puddles reflecting neon lights, 35mm, slow tracking shot',
        status: 'rendered',
        imageUrl: 'http://127.0.0.1:8188/view?filename=shot1_rainy_street.png',
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

    // 联系人体系
    this.agents = [
      { id: 'Cl', name: 'Claude', shortName: 'Cl', avatarClass: 'a-claude', systemPrompt: '写提示词 · 提示词专家', provider: 'anthropic', modelName: 'claude-3-7-sonnet', driverType: 'cloud_api', status: 'spoke' },
      { id: 'Gp', name: 'ChatGPT', shortName: 'Gp', avatarClass: 'a-gpt', systemPrompt: '出分镜图 · 分镜师', provider: 'openai', modelName: 'gpt-4o', driverType: 'cloud_api', status: 'spoke' },
      { id: 'Ge', name: 'Gemini', shortName: 'Ge', avatarClass: 'a-gem', systemPrompt: '查资料 · 知识检索', provider: 'google', modelName: 'gemini-2-0-flash', driverType: 'cloud_api', status: 'ready' },
      { id: 'Ds', name: 'DeepSeek', shortName: 'DS', avatarClass: 'a-ds', systemPrompt: '写代码 · 技术推理', provider: 'deepseek', modelName: 'deepseek-reasoner', driverType: 'cloud_api', status: 'thinking' },
      { id: 'Gr', name: 'Grok Bot', shortName: 'Gr', avatarClass: 'a-grok', systemPrompt: '搭工作流 · 工作流专家', provider: 'xai', modelName: 'grok-2', driverType: 'cloud_api', status: 'ready' },
      { id: 'Cc', name: 'Claude Code', shortName: 'Cc', avatarClass: 'a-cli', systemPrompt: '本地编程 · ACP 架构', provider: 'local-cli', modelName: 'claude-code-acp', driverType: 'local_acp', status: 'ready' },
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

    let roomTitle = '短片《雨夜》制作会诊';
    if (this.currentRoomId === 'comfyui-fix') {
      roomTitle = t('comfyFix');
    } else if (this.currentRoomId === 'storyboard-clinic') {
      roomTitle = t('storyboardClinic');
    } else if (this.currentRoomId === 'general-clinic') {
      roomTitle = t('generalClinic');
    }

    // 1. 左栏云端助手列表
    const cloudAgentsHtml = this.agents
      .filter((a) => a.driverType === 'cloud_api')
      .map((agent) => {
        const isThinking = this.thinkingAgents.has(agent.id) || agent.id === 'Ds';
        return `
          <div class="item ${isThinking ? 'thinking' : ''}" data-agent="${agent.id}">
            <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
            ${agent.name}
            ${isThinking ? `<span class="think-tag">${t('statusThinking')}</span>` : `<span class="dot"></span>`}
          </div>
        `;
      })
      .join('');

    // 2. 左栏本地工具列表
    const localToolsHtml = `
      <div class="item" data-tool="claude-code">
        <div class="ava a-cli">Cc</div>Claude Code
        <span class="badge">${this.isDesktop ? '✓ 本地' : t('needsDesktop')}</span>
      </div>
      <div class="item" data-tool="comfyui">
        <div class="ava a-cui">Cu</div>ComfyUI
        <span class="badge">${this.isDesktop ? '✓ 本地' : t('needsDesktop')}</span>
      </div>
    `;

    // 3. 右栏成员状态
    const memberRowsHtml = this.agents
      .filter((a) => a.driverType === 'cloud_api')
      .map((agent) => {
        const isThinking = this.thinkingAgents.has(agent.id) || agent.id === 'Ds';
        let stClass = 'st';
        let stText = t('statusReady');

        if (isThinking) {
          stClass = 'st hot';
          stText = t('statusThinking');
        } else if (agent.id === 'Cl' || agent.id === 'Gp') {
          stText = t('statusSpoke');
        }

        return `
          <div class="mrow" data-member="${agent.id}">
            <div class="ava ${agent.avatarClass}">${agent.shortName}</div>
            ${agent.name}
            <span class="${stClass}">${stText}</span>
          </div>
        `;
      })
      .join('');

    // 4. 分镜表汇总表格（分镜会诊室右栏卡片）
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

    // 5. 分镜卡 HTML 生成器
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
        ? `<div class="img-preview"><img src="${shot.imageUrl}" alt="镜头 #${shot.shotNumber} 样片" /></div>`
        : '';

      return `
        <div class="shot-card" data-shot="${shot.shotNumber}">
          <div class="head">
            <span class="t">镜头 #${shot.shotNumber} · ${shot.shotScale}</span>
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

    // 6. 主消息区内容根据房间切换
    let mainMessagesHtml = '';
    if (this.currentRoomId === 'storyboard-clinic') {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">主</div>
          <div>
            <div class="who"><b>主持人</b> 10:00</div>
            <div class="bubble">欢迎进入 <b>分镜与镜头会诊室</b>。本轮流程：ChatGPT 规划分镜结构、Claude 精炼镜头英文提示词、DeepSeek 调整参数，Grok Bot 调度 ComfyUI 生成样片并汇总成表。</div>
          </div>
        </div>

        <div class="msg" data-msg-agent="Gp">
          <div class="ava a-gpt lg">Gp</div>
          <div>
            <div class="who"><b>ChatGPT</b> · 分镜师</div>
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
            🎨 <b>ComfyUI 诊断工作台</b>：提交工作流 JSON 进行执行诊断与节点报错排查
          </div>
          <button class="send" id="btn-submit-workflow" style="padding:6px 14px;font-size:12px;border-radius:8px;">
            ${t('comfySubmitWorkflow')}
            ${!this.isDesktop ? `<span style="font-size:10px;margin-left:4px;opacity:0.9;">(${t('needsDesktop')})</span>` : ''}
          </button>
        </div>
        <div class="msg host">
          <div class="ava a-host lg">主</div>
          <div>
            <div class="who"><b>主持人</b> 09:40</div>
            <div class="bubble">这里是 <b>ComfyUI 报错会诊室</b>。请提交出问题的工作流，系统将自动为你生成结构化报错会诊单。</div>
          </div>
        </div>
      `;
    } else {
      mainMessagesHtml = `
        <div class="msg host">
          <div class="ava a-host lg">主</div>
          <div>
            <div class="who"><b>主持人</b> 09:41</div>
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

    this.container.innerHTML = `
      <div class="app">
        <!-- 顶栏：54px -->
        <div class="topbar">
          <div class="logo">Take<span>Chat</span></div>
          <div class="rt" id="topbar-room-name">${roomTitle}</div>
          <div class="sp"></div>
          <button class="tbtn" id="btn-lang" title="切换双语">${otherLocale}</button>
          <button class="tbtn" id="btn-settings" title="打开设置">⚙</button>
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
              ${t('storyboardClinic')} <span class="badge" style="background:#E1F5FE;color:#0277BD;">新</span>
            </div>

            <h4>${t('cloudAgentsTitle')}</h4>
            ${cloudAgentsHtml}

            <h4>${t('localToolsTitle')}</h4>
            ${localToolsHtml}

            <div class="grow"></div>

            <!-- 左下角账本小卡 -->
            <div class="mini-card">
              <h5>${t('ledgerTitle')}</h5>
              <div class="r"><span>${t('ledgerSession')}</span><b id="ledger-session-cost">$0.00</b></div>
              <div class="lbar"><i id="ledger-session-bar" style="width:2%"></i></div>
              <div class="r"><span>${t('ledgerMonthly')}</span><b id="ledger-monthly-cost">$0.00 / $20</b></div>
              <div class="lbar"><i id="ledger-monthly-bar" style="width:2%"></i></div>
            </div>
          </aside>

          <!-- 主区：聊天 -->
          <section class="main">
            <div class="chat-head">
              <div class="t" id="chat-title">${roomTitle}</div>
              <div class="s" id="chat-subtitle">${t('modeTagBroadcast')} · ChatGPT、Claude、DeepSeek、Grok Bot 在场</div>
            </div>

            <div class="msgs" id="msg-stream">
              ${mainMessagesHtml}
            </div>

            <div class="composer">
              <span class="mode-toggle" id="btn-mode-toggle">${this.isBroadcastMode ? t('broadcastOn') : t('broadcastOff')}</span>
              <input class="box" id="chat-input" placeholder="${t('inputPlaceholder')}" />
              <button class="send" id="btn-send">${t('sendBtn')}</button>
            </div>
          </section>

          <!-- 右栏：272px 进度与状态双卡 -->
          <aside class="right">
            <!-- 卡片 1: 本次会诊进度 -->
            <div class="card">
              <h5>${t('progressTitle')}</h5>
              <div class="step"><span class="ic">✓</span>${t('stepPromptClaude')}</div>
              <div class="step"><span class="ic">✓</span>${t('stepWorkflowGrok')}</div>
              <div class="step"><span class="ic">✓</span>${t('stepStoryboardChatgpt')}</div>
              <div class="step doing"><span class="ic">…</span>${t('stepCodeDeepseek')}</div>
              <div class="step wait"><span class="ic">5</span>${t('stepHostSummary')}</div>
            </div>

            <!-- 卡片 2: 分镜表汇总（若在分镜会诊室）或成员状态 -->
            ${
              this.currentRoomId === 'storyboard-clinic'
                ? `
              <div class="card">
                <h5>${t('storyboardTableTitle')}</h5>
                <table class="sb-table">
                  <thead>
                    <tr><th>镜号</th><th>景别</th><th>状态</th></tr>
                  </thead>
                  <tbody id="sb-table-body">
                    ${sbTableRows}
                  </tbody>
                </table>
              </div>
            `
                : `
              <div class="card">
                <h5>${t('membersTitle')}</h5>
                ${memberRowsHtml}
              </div>
            `
            }
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

    // 房间切换事件
    this.container.querySelectorAll('.rail .item[data-room]').forEach((roomEl) => {
      roomEl.addEventListener('click', () => {
        const roomId = roomEl.getAttribute('data-room');
        if (roomId && roomId !== this.currentRoomId) {
          this.currentRoomId = roomId;
          this.render();
          this.bindEvents();
          this.refreshLedgerDisplay();
        }
      });
    });

    // 本地工具点击降级提示
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
          // 浏览器版标准降级阻断
          alert(t('needsDesktopNotice'));
          return;
        }

        // 桌面端执行 ComfyUI 出图
        btn.disabled = true;
        btn.textContent = '出图中…';
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
            alert(`出图失败: ${result.rawError || '未知错误'}`);
            btn.disabled = false;
            btn.textContent = t('btnRenderShot');

          }
        } catch (err) {
          alert(`出图异常: ${err instanceof Error ? err.message : String(err)}`);
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
      this.render();
      this.bindEvents();
      this.refreshLedgerDisplay();
    });

    // 模式切换
    modeBtn?.addEventListener('click', () => {
      this.isBroadcastMode = !this.isBroadcastMode;
      modeBtn.textContent = this.isBroadcastMode ? t('broadcastOn') : t('broadcastOff');
      modeBtn.style.color = this.isBroadcastMode ? '#C8402A' : '#57524A';
      modeBtn.style.borderColor = this.isBroadcastMode ? '#C8402A' : '#E3DCCB';
    });

    // 发送消息
    const handleSend = () => {
      const text = inputEl.value.trim();
      if (!text || this.isGenerating) return;
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
          <div class="who"><b>${agent.name}</b> · ${agent.systemPrompt} <span class="thinklbl">思考中…</span></div>
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
      const simulatedText = `针对「${prompt.slice(0, 15)}...」，已基于前序讨论完成处理方案输出。`;
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
    const sBarEl = this.container.querySelector('#ledger-session-bar') as HTMLElement;
    const mBarEl = this.container.querySelector('#ledger-monthly-bar') as HTMLElement;

    if (sCostEl) {
      sCostEl.textContent = `$${sSummary.costUsd.toFixed(2)}`;
    }
    if (mCostEl) {
      mCostEl.textContent = `$${mSummary.costUsd.toFixed(2)} / $${limits.monthlyLimitUsd}`;
    }
    if (sBarEl) {
      const percent = Math.min(100, Math.max(2, (sSummary.costUsd / limits.sessionLimitUsd) * 100));
      sBarEl.style.width = `${percent}%`;
    }
    if (mBarEl) {
      const percent = Math.min(100, Math.max(2, (mSummary.costUsd / limits.monthlyLimitUsd) * 100));
      mBarEl.style.width = `${percent}%`;
    }
  }
}
