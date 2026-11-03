/**
 * @take/ui - ChatApp.ts
 * 纯前端 TypeScript 共享核心 UI 组件
 * 单一权威源：供 apps/web 与 apps/desktop 共同引入，彻底杜绝双份代码拷贝
 */

import { ContextEngine, Session, Message, AgentProfile, EngineEvent } from '@take/engine';

export interface ChatAppOptions {
  container: HTMLElement;
  isDesktop?: boolean;
}

export class ChatApp {
  private container: HTMLElement;
  private isDesktop: boolean;
  private engine: ContextEngine;
  private session: Session;
  private agents: AgentProfile[];
  private isBroadcastMode: boolean = true;
  private isGenerating: boolean = false;
  private thinkingAgents: Set<string> = new Set();

  constructor(options: ChatAppOptions) {
    this.container = options.container;
    this.isDesktop = options.isDesktop ?? false;
    this.engine = new ContextEngine();

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
      totalTokensUsed: 1200,
      isClosed: false,
    };

    this.setupEngineListeners();
  }

  public mount(): void {
    this.render();
    this.bindEvents();
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
        case 'usage':
          this.updateLedgerMeter(event.usage.totalTokens);
          break;
      }
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="win">
        <!-- 窗口顶栏 (Titlebar Chrome) -->
        <div class="chrome">
          <span class="dot" style="background:#C9BFA8"></span>
          <span class="dot" style="background:#A39A88"></span>
          <span class="dot" style="background:#7A7368"></span>
          <div class="logo" style="margin-left:6px">
            <div class="mark" style="width:26px;height:26px;border-radius:7px"></div>
            <div class="brand" style="font-size:16px">TakeChat</div>
          </div>
          <div class="apptitle">短片《雨夜》制作会诊</div>
          <span class="quota" id="ledger-badge">本机账本 · 本月 $3.86 / 警戒线 $20</span>
          <span class="quota" id="settings-btn" style="cursor:pointer">⚙ 设置</span>
          <div class="me" style="width:28px;height:28px;font-size:12px">你</div>
          <div class="wctl"><span>─</span><span>▢</span><span>✕</span></div>
        </div>

        <div class="body">
          <!-- 左侧旁联联系人与房间列表 -->
          <aside class="side">
            <h4>房 间</h4>
            <div class="room on" data-room="prompt-clinic">提示词会诊 <span class="n">进行中</span></div>
            <div class="room" data-room="general-clinic">通用会诊室</div>
            <div class="room" data-room="comfyui-fix">ComfyUI 报错会诊</div>
            <div class="room" style="opacity:0.7">＋ 新建房间</div>

            <h4 style="margin-top:18px">联 系 人</h4>
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
              <div><b>添加联系人</b><span>API 或本地 CLI</span></div>
            </div>
          </aside>

          <!-- 中间本体对话流 -->
          <section class="main">
            <div class="chathead">
              <b>短片《雨夜》制作会诊</b>
              <span class="tag" id="mode-tag">会诊模式 · 全员接力</span>
              <span>Claude、Grok Bot、ChatGPT、Gemini 在场</span>
            </div>

            <div class="msgs" id="msg-stream">
              <div class="msg me">
                <div class="av" style="background:#C8402A">你</div>
                <div>
                  <div class="who">你</div>
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
                <b>主持人汇总：</b>三步都齐了——提示词（Claude）、可跑的工作流（Grok Bot）、分镜草图（ChatGPT）。分工没有重叠，构图和提示词对得上，可以开拍。
                <div class="hostbtns">
                  <button class="btn red" id="btn-approve">就按这个开拍</button>
                  <button class="btn ghost" id="btn-retry">分镜再改一版</button>
                </div>
              </div>
            </div>

            <!-- 底部输入栏 -->
            <div class="inputbar">
              <button class="at" id="btn-at" title="点击定向 @ 专家">@</button>
              <span class="mode" id="btn-mode">会诊模式 · 开</span>
              <input id="chat-input" placeholder="发一句话，或 @ 一位专家单独问…" />
              <button class="send" id="btn-send">发送</button>
            </div>
          </section>

          <!-- 右侧会诊进度与本地账本面板 -->
          <aside class="panel">
            <h4>本 次 会 诊 进 度</h4>
            <div class="step" id="step-cl"><span class="st">✓</span>写提示词 · Claude</div>
            <div class="step" id="step-gk"><span class="st">✓</span>搭工作流 · Grok Bot</div>
            <div class="step" id="step-gp"><span class="st">✓</span>出分镜图 · ChatGPT</div>
            <div class="step wait" id="step-me"><span class="st">4</span>汇总拍板 · 等你</div>

            <div class="meter">
              <h4>本 地 用 量 账 本</h4>
              <p id="ledger-text">本次 $0.12 / 警戒线 $2</p>
              <div class="bar"><i id="ledger-bar" style="width:17%"></i></div>
              <small>每个专家只答一次；账本只存本机，逼近警戒线只提醒、不锁死。</small>
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
      modeBtn.textContent = this.isBroadcastMode ? '会诊模式 · 开' : '单聊模式 · 关';
      modeBtn.style.background = this.isBroadcastMode ? '#FDF0EC' : '#F3EFE6';
      modeBtn.style.color = this.isBroadcastMode ? '#C8402A' : '#57524A';
      modeBtn.style.borderColor = this.isBroadcastMode ? '#C8402A' : '#E3DCCB';
      const tag = this.container.querySelector('#mode-tag') as HTMLElement;
      if (tag) {
        tag.textContent = this.isBroadcastMode ? '会诊模式 · 全员接力' : '单聊模式 · @定向点名';
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
      <div class="av" style="background:#C8402A">你</div>
      <div>
        <div class="who">你</div>
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
      senderName: '你',
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

      await new Promise((r) => setTimeout(r, 500));
      const simulatedText = `针对「${prompt.slice(0, 15)}...」，已基于前序讨论完成处理方案输出。`;
      for (let i = 0; i < simulatedText.length; i += 3) {
        const chunk = simulatedText.slice(i, i + 3);
        this.engine.notifyChunk(this.session.id, turnIndex, agentId, chunk);
        await new Promise((r) => setTimeout(r, 50));
      }

      completedTurnInsights.set(agentId, { agentName: agent.name, content: simulatedText });
      this.engine.notifyAgentDone(
        this.session.id,
        turnIndex,
        agentId,
        simulatedText,
        assembledPayload.length * 50,
        150
      );
    }

    this.engine.notifyTurnDone(this.session.id, turnIndex, targetAgentIds, 450);
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
      sendBtn.textContent = this.isGenerating ? '思考中…' : '发送';
    }
  }

  private updateLedgerMeter(addTokens: number): void {
    this.session.totalTokensUsed += addTokens;
    const cost = (this.session.totalTokensUsed * 0.000003).toFixed(2);
    const badge = this.container.querySelector('#ledger-badge');
    const text = this.container.querySelector('#ledger-text');
    if (badge) badge.textContent = `本机账本 · 本月 $${cost} / 警戒线 $20`;
    if (text) text.textContent = `本次 $${cost} / 警戒线 $2`;
  }
}

