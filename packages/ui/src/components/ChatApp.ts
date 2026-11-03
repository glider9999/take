/**
 * @take/ui - ChatApp.ts (Phase 1 定版收官)
 * TakeChat 核心交互组件：全面集成真实本地账本 LocalLedger（替换假数字）＋中英双语 i18n
 */

import { ContextEngine, Session, Message, AgentProfile, EngineEvent, LocalLedger } from '@take/engine';
import { t, getLocale, setLocale, Locale } from '../i18n/index.js';

export interface ChatAppOptions {
  container: HTMLElement;
  isDesktop?: boolean;
}

export class ChatApp {
  private container: HTMLElement;
  private isDesktop: boolean;
  private engine: ContextEngine;
  private ledger: LocalLedger;
  private session: Session;
  private agents: AgentProfile[];
  private isBroadcastMode: boolean = true;
  private isGenerating: boolean = false;
  private thinkingAgents: Set<string> = new Set();

  constructor(options: ChatAppOptions) {
    this.container = options.container;
    this.isDesktop = options.isDesktop ?? false;
    this.engine = new ContextEngine();
    // 实例化真实本地财务账本（默认自设警戒线：单会话 $2，每月 $20）
    this.ledger = new LocalLedger({ sessionLimitUsd: 2.0, monthlyLimitUsd: 20.0 });

    this.agents = [
      { id: 'Cl', name: 'Claude', systemPrompt: '写提示词 · 提示词专家', provider: 'anthropic', modelName: 'claude-3-7-sonnet' },
      { id: 'Gk', name: 'Grok Bot', systemPrompt: '搭工作流 · 工作流专家', provider: 'xai', modelName: 'grok-2' },
      { id: 'Gp', name: 'ChatGPT', systemPrompt: '出分镜图 · 分镜师', provider: 'openai', modelName: 'gpt-4o' },
      { id: 'Gm', name: 'Gemini', systemPrompt: '查资料 · 知识检索', provider: 'google', modelName: 'gemini-2-0-flash' },
      { id: 'Ds', name: 'DeepSeek', systemPrompt: '写代码 · 技术推理', provider: 'deepseek', modelName: 'deepseek-reasoner' },
    ];

    this.session = {
      id: 'session-rainynight',
      roomId: 'prompt-clinic',
      title: '短片《雨夜》制作会诊',
      history: [],
      activeAgentIds: ['Cl', 'Gk', 'Gp', 'Gm', 'Ds'],
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
    // 监听引擎事件流
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
          // 真实账本消费 usage 事件并折算更新
          const agent = this.agents.find((a) => a.id === event.agentId);
          this.ledger.recordUsage(event, agent?.modelName || 'gpt-4o');
          this.refreshLedgerDisplay();
          break;
        }
      }
    });

    // 监听警戒线软提醒
    this.ledger.setWarningCallback((msg, isOver) => {
      const badge = this.container.querySelector('#ledger-badge') as HTMLElement;
      if (badge) {
        badge.style.color = '#C8402A';
        badge.style.borderColor = '#C8402A';
        badge.title = msg;
      }
      console.warn(`[LocalLedger 警戒线软提醒]: ${msg} (超限=${isOver})`);
    });
  }

  private render(): void {
    const curLocale = getLocale();
    const otherLocale = curLocale === 'zh-CN' ? 'EN' : '中';

    this.container.innerHTML = `
      <div class="win">
        <!-- 窗口顶栏 (Titlebar Chrome) -->
        <div class="chrome">
          <span class="dot" style="background:#C9BFA8"></span>
          <span class="dot" style="background:#A39A88"></span>
          <span class="dot" style="background:#7A7368"></span>
          <div class="logo" style="margin-left:6px">
            <div class="mark" style="width:26px;height:26px;border-radius:7px"></div>
            <div class="brand" style="font-size:16px">${t('brandTitle')}</div>
          </div>
          <div class="apptitle">短片《雨夜》制作会诊</div>
          <span class="quota" id="ledger-badge">本机账本 · 计算中...</span>
          <button class="quota" id="btn-lang" style="cursor:pointer;border:none">${otherLocale}</button>
          <span class="quota" id="settings-btn" style="cursor:pointer">${t('settings')}</span>
          <div class="me" style="width:28px;height:28px;font-size:12px">${t('you')}</div>
          <div class="wctl"><span>─</span><span>▢</span><span>✕</span></div>
        </div>

        <div class="body">
          <!-- 左侧旁联联系人与房间列表 -->
          <aside class="side">
            <h4>${t('roomsTitle')}</h4>
            <div class="room on" data-room="prompt-clinic">${t('promptClinic')} <span class="n">${t('inProgress')}</span></div>
            <div class="room" data-room="general-clinic">${t('generalClinic')}</div>
            <div class="room" data-room="comfyui-fix">${t('comfyFix')}</div>
            <div class="room" style="opacity:0.7">${t('addRoom')}</div>

            <h4 style="margin-top:18px">${t('contactsTitle')}</h4>
            <div class="agent" data-agent="Cl">
              <div class="av" data-av="Cl">Cl<i></i></div>
              <div><b>Claude</b><span data-status="Cl">写提示词</span></div>
            </div>
            <div class="agent" data-agent="Gk">
              <div class="av" data-av="Gk">Gk<i></i></div>
              <div><b>Grok Bot</b><span data-status="Gk">搭工作流</span></div>
            </div>
            <div class="agent" data-agent="Gp">
              <div class="av" data-av="Gp">Gp<i></i></div>
              <div><b>ChatGPT</b><span data-status="Gp">出分镜图</span></div>
            </div>
            <div class="agent" data-agent="Gm">
              <div class="av" data-av="Gm">Gm<i></i></div>
              <div><b>Gemini</b><span data-status="Gm">查资料</span></div>
            </div>
            <div class="agent" data-agent="Ds">
              <div class="av" data-av="Ds">Ds<i></i></div>
              <div><b>DeepSeek</b><span data-status="Ds">写代码</span></div>
            </div>
            <div class="agent" style="opacity:0.7">
              <div class="av" style="background:#57524A">＋<i style="display:none"></i></div>
              <div><b>${t('addContact')}</b><span>API 或本地 CLI</span></div>
            </div>
          </aside>

          <!-- 中间本体对话流 -->
          <section class="main">
            <div class="chathead">
              <b>短片《雨夜》制作会诊</b>
              <span class="tag" id="mode-tag">${this.isBroadcastMode ? t('modeTagBroadcast') : t('modeTagMention')}</span>
              <span>Claude、Grok Bot、ChatGPT、Gemini 在场</span>
            </div>

            <div class="msgs" id="msg-stream">
              <div class="msg me">
                <div class="av" style="background:#C8402A">${t('you')}</div>
                <div>
                  <div class="who">${t('you')}</div>
                  <div class="bub">帮我做一个雨夜便利店的镜头：女孩撑伞走过，霓虹倒影在水洼里。从提示词到分镜，一条龙。</div>
                </div>
              </div>

              <div class="msg" data-msg-agent="Cl">
                <div class="av" data-av="Cl">Cl</div>
                <div>
                  <div class="who"><b>Claude</b> · 提示词专家</div>
                  <div class="bub">
                    提示词写好了，重点压了三处：雨丝密度、霓虹色温、水洼倒影。
                    <code>cinematic shot, girl with transparent umbrella walks past a convenience store at night, heavy rain, neon signs reflecting in puddles, teal and magenta, 35mm, slow tracking shot…</code>
                  </div>
                </div>
              </div>

              <div class="msg" data-msg-agent="Gk">
                <div class="av" data-av="Gk">Gk</div>
                <div>
                  <div class="who"><b>Grok Bot</b> · 工作流专家</div>
                  <div class="bub">
                    接上了。给你排了能直接跑的流程：首帧图 → 图生视频（运镜选「缓慢横移」）→ 雨效节点 → 调色。参数都按 Claude 的提示词对齐，不用再手调。
                  </div>
                </div>
              </div>

              <div class="msg" data-msg-agent="Gp">
                <div class="av" data-av="Gp">Gp</div>
                <div>
                  <div class="who"><b>ChatGPT</b> · 分镜师</div>
                  <div class="bub">
                    分镜图先画了三格，你看构图对不对味，对了我再补全 6 格。
                    <div class="shots">
                      <div class="shot s1">镜头 1 · 全景 便利店外景</div>
                      <div class="shot s2">镜头 2 · 中景 女孩撑伞走过</div>
                      <div class="shot s3">镜头 3 · 特写 水洼霓虹倒影</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="host" id="host-card">
                <b>${t('hostSummaryTitle')}</b>三步都齐了——提示词（Claude）、可跑的工作流（Grok Bot）、分镜草图（ChatGPT）。分工没有重叠，构图和提示词对得上，可以开拍。
                <div class="hostbtns">
                  <button class="btn red" id="btn-approve">${t('btnApprove')}</button>
                  <button class="btn ghost" id="btn-retry">${t('btnRetry')}</button>
                </div>
              </div>
            </div>

            <!-- 底部输入栏 -->
            <div class="inputbar">
              <button class="at" id="btn-at" title="点击定向 @ 专家">@</button>
              <span class="mode" id="btn-mode">${this.isBroadcastMode ? t('broadcastOn') : t('broadcastOff')}</span>
              <input id="chat-input" placeholder="${t('inputPlaceholder')}" />
              <button class="send" id="btn-send">${t('sendBtn')}</button>
            </div>
          </section>

          <!-- 右侧会诊进度与真实本地账本面板 -->
          <aside class="panel">
            <h4>${t('progressTitle')}</h4>
            <div class="step" id="step-cl"><span class="st">✓</span>${t('stepPrompt')}</div>
            <div class="step" id="step-gk"><span class="st">✓</span>${t('stepWorkflow')}</div>
            <div class="step" id="step-gp"><span class="st">✓</span>${t('stepStoryboard')}</div>
            <div class="step wait" id="step-me"><span class="st">4</span>${t('stepSummary')}</div>

            <div class="meter">
              <h4>${t('ledgerTitle')}</h4>
              <p id="ledger-text">本次 $0.00 / 警戒线 $2</p>
              <div class="bar"><i id="ledger-bar" style="width:2%"></i></div>
              <small>${t('ledgerTip')}</small>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const inputEl = this.container.querySelector('#chat-input') as HTMLInputElement;
    const sendBtn = this.container.querySelector('#btn-send') as HTMLButtonElement;
    const modeBtn = this.container.querySelector('#btn-mode') as HTMLSpanElement;
    const atBtn = this.container.querySelector('#btn-at') as HTMLButtonElement;
    const langBtn = this.container.querySelector('#btn-lang') as HTMLButtonElement;

    // 语言切换
    langBtn?.addEventListener('click', () => {
      const nextLocale: Locale = getLocale() === 'zh-CN' ? 'en-US' : 'zh-CN';
      setLocale(nextLocale);
      this.render();
      this.bindEvents();
      this.refreshLedgerDisplay();
    });

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

    modeBtn.addEventListener('click', () => {
      this.isBroadcastMode = !this.isBroadcastMode;
      modeBtn.textContent = this.isBroadcastMode ? t('broadcastOn') : t('broadcastOff');
      modeBtn.style.background = this.isBroadcastMode ? '#FDF0EC' : '#F3EFE6';
      modeBtn.style.color = this.isBroadcastMode ? '#C8402A' : '#57524A';
      modeBtn.style.borderColor = this.isBroadcastMode ? '#C8402A' : '#E3DCCB';
      const tag = this.container.querySelector('#mode-tag') as HTMLElement;
      if (tag) {
        tag.textContent = this.isBroadcastMode ? t('modeTagBroadcast') : t('modeTagMention');
      }
    });

    atBtn.addEventListener('click', () => {
      inputEl.value += '@Claude ';
      inputEl.focus();
    });

    this.container.querySelectorAll('.agent[data-agent]').forEach((el) => {
      el.addEventListener('click', () => {
        const agentId = el.getAttribute('data-agent');
        if (agentId) {
          const isNowThinking = !this.thinkingAgents.has(agentId);
          this.setAgentThinking(agentId, isNowThinking);
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
      <div class="av" style="background:#C8402A">${t('you')}</div>
      <div>
        <div class="who">${t('you')}</div>
        <div class="bub">${prompt}</div>
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

      this.engine.notifyTyping(this.session.id, turnIndex, agentId, true);

      const agentMsgEl = document.createElement('div');
      agentMsgEl.className = 'msg';
      agentMsgEl.setAttribute('data-msg-agent', agentId);
      agentMsgEl.innerHTML = `
        <div class="av think" data-av="${agentId}">${agent.id}</div>
        <div>
          <div class="who"><b>${agent.name}</b> · ${agent.systemPrompt} <span class="thinklbl">思考中<span class="tdots"><i></i><i></i><i></i></span></span></div>
          <div class="bub" id="bub-${agentId}-${turnIndex}"></div>
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

    const sideAv = this.container.querySelector(`.side .av[data-av="${agentId}"]`);
    const sideStatus = this.container.querySelector(`.side [data-status="${agentId}"]`);
    if (sideAv) sideAv.classList.toggle('think', isThinking);
    if (sideStatus) {
      sideStatus.classList.toggle('thinklbl', isThinking);
      if (isThinking) {
        sideStatus.innerHTML = `生成中 <span class="tdots"><i></i><i></i><i></i></span>`;
      } else {
        const agent = this.agents.find((a) => a.id === agentId);
        sideStatus.textContent = agent ? agent.systemPrompt.split('·')[0].trim() : '就绪';
      }
    }

    this.container.querySelectorAll(`.msgs .av[data-av="${agentId}"]`).forEach((el) => {
      el.classList.toggle('think', isThinking);
    });
  }

  private appendAgentChunk(agentId: string, text: string): void {
    const stream = this.container.querySelector('#msg-stream') as HTMLElement;
    const bub = this.container.querySelector(`[data-msg-agent="${agentId}"]:last-of-type .bub`);
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
      const bub = msgEl.querySelector('.bub');
      if (bub) bub.textContent = finalContent;
    }
  }

  private syncAllAvatars(): void {
    this.container.querySelectorAll('.av').forEach((el) => {
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

  /**
   * 刷新界面账本读数（接通 LocalLedger 真实数据）
   */
  private refreshLedgerDisplay(): void {
    const sSummary = this.ledger.getSessionSummary(this.session.id);
    const mSummary = this.ledger.getMonthlySummary();
    const limits = this.ledger.getLimits();

    const badge = this.container.querySelector('#ledger-badge');
    const text = this.container.querySelector('#ledger-text');
    const bar = this.container.querySelector('#ledger-bar') as HTMLElement;

    if (badge) {
      badge.textContent = `本机账本 · 本月 $${mSummary.costUsd.toFixed(2)} / 警戒线 $${limits.monthlyLimitUsd}`;
    }
    if (text) {
      text.textContent = `本次 $${sSummary.costUsd.toFixed(2)} / 警戒线 $${limits.sessionLimitUsd}`;
    }
    if (bar) {
      const percent = Math.min(100, Math.max(2, (sSummary.costUsd / limits.sessionLimitUsd) * 100));
      bar.style.width = `${percent.toFixed(0)}%`;
      bar.style.background = sSummary.isOverLimit ? '#C8402A' : '#1C1A17';
    }
  }
}

