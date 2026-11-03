/**
 * @take/engine - engine.test.ts (v2 修正版)
 * Vitest 核心自动化测试套件：覆盖工单 03 规定的四大硬性断言与互见组装特性
 * 修正注记：用例 f) 接入 engine.initTurn 门面正式开轮，修复 turnIndex 调度器纪律校验
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextEngine,
  TurnScheduler,
  ContextCompressor,
  ContextAssembler,
  Session,
  Message,
  AgentProfile,
} from '../src/index.js';

describe('ContextEngine & Orchestrator Core Test Suite', () => {
  let engine: ContextEngine;
  let sampleSession: Session;
  let sampleAgents: AgentProfile[];

  beforeEach(() => {
    engine = new ContextEngine();
    sampleAgents = [
      {
        id: 'claude',
        name: 'Claude 3.7',
        systemPrompt: '你是严谨架构师',
        provider: 'anthropic',
        modelName: 'claude-3-7-sonnet',
      },
      {
        id: 'deepseek',
        name: 'DeepSeek R1',
        systemPrompt: '你是深度推理大师',
        provider: 'deepseek',
        modelName: 'deepseek-reasoner',
      },
      {
        id: 'gpt4o',
        name: 'GPT-4o',
        systemPrompt: '你是通用智囊',
        provider: 'openai',
        modelName: 'gpt-4o',
      },
    ];

    sampleSession = {
      id: 'session-101',
      roomId: 'room-main',
      title: '架构评审会',
      history: [],
      activeAgentIds: ['claude', 'deepseek', 'gpt4o'],
      tokenBudget: 50000,
      totalTokensUsed: 0,
      isClosed: false,
    };
  });

  // =========================================================================
  // a) 只有用户消息能开新轮
  // =========================================================================
  it('a) 必须且只能由用户消息开启新轮次，Agent 或系统消息触发应严格拦截抛错', () => {
    const agentMsg: Message = {
      id: 'msg-1',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'agent',
      senderId: 'claude',
      senderName: 'Claude 3.7',
      content: 'Agent 尝试自动触发下一轮回复',
      createdAt: Date.now(),
    };

    const sysMsg: Message = {
      id: 'msg-2',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'system',
      senderId: 'system',
      senderName: 'System',
      content: '系统定时触发',
      createdAt: Date.now(),
    };

    const userMsg: Message = {
      id: 'msg-3',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: 'Mobi',
      content: '这是正式用户提问',
      createdAt: Date.now(),
    };

    // 1. Agent 消息开轮被拒
    expect(() => engine.initTurn(sampleSession, agentMsg)).toThrow(
      'Only user messages can initiate a new turn'
    );

    // 2. 系统消息开轮被拒
    expect(() => engine.initTurn(sampleSession, sysMsg)).toThrow(
      'Only user messages can initiate a new turn'
    );

    // 3. 用户消息合法开轮，轮次自增
    const { turnIndex, targetAgentIds } = engine.initTurn(sampleSession, userMsg, 'mention');
    expect(turnIndex).toBe(1);
    expect(targetAgentIds.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // b) 每轮每 Agent 至多一答
  // =========================================================================
  it('b) 每轮每 Agent 严格限制至多作答一次，同一轮二次提交应被拒绝', () => {
    const userMsg: Message = {
      id: 'msg-1',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: 'Mobi',
      content: '请全体汇报',
      createdAt: Date.now(),
    };

    const { turnIndex } = engine.initTurn(sampleSession, userMsg, 'broadcast');
    const scheduler = engine.getScheduler();

    // 首次登记作答成功
    expect(scheduler.canAgentRespond('claude', turnIndex)).toBe(true);
    engine.notifyAgentDone('session-101', turnIndex, 'claude', '首轮回答完成', 100, 200);

    // 状态变迁：已不可再次作答
    expect(scheduler.canAgentRespond('claude', turnIndex)).toBe(false);

    // 同一轮再次尝试提交同 Agent 回复，触发硬拦截
    expect(() => {
      engine.notifyAgentDone('session-101', turnIndex, 'claude', '企图二次作答', 100, 200);
    }).toThrow('Agent claude has already responded in turn 1');

    // 其他未回答的 Agent 仍具备作答资格
    expect(scheduler.canAgentRespond('deepseek', turnIndex)).toBe(true);
  });

  // =========================================================================
  // c) 组装窗口（近 10 条＋摘要）正确
  // =========================================================================
  it('c) 历史消息超过 10 条时严格截断，保留最近 10 条明文，并置顶注入 200 字内结构化摘要', () => {
    // 构造 16 条历史消息（超出 10 条窗口上限）
    const fullHistory: Message[] = [];
    for (let i = 1; i <= 16; i++) {
      fullHistory.push({
        id: `h-msg-${i}`,
        sessionId: 'session-101',
        turnIndex: Math.ceil(i / 2),
        senderType: i % 2 === 1 ? 'user' : 'agent',
        senderId: i % 2 === 1 ? 'user' : 'claude',
        senderName: i % 2 === 1 ? 'Mobi' : 'Claude',
        content: `这是第 ${i} 轮详细讨论内容，讨论了技术架构与设计方案。`,
        createdAt: Date.now() + i * 1000,
      });
    }

    const currentPrompt = '请总结并给出最终结论';
    const payload = engine.assembleForAgent(sampleAgents[0], fullHistory, currentPrompt);

    // 1. 检验 System Prompt 注入了结构化摘要
    const systemItem = payload.find((item) => item.role === 'system');
    expect(systemItem).toBeDefined();
    expect(systemItem?.content).toContain('【历史摘要】');
    expect(systemItem?.content).toContain('早期多模型协作讨论');

    // 2. 检验滑动窗口：payload 中包含的历史非系统消息条数严格等于 10 条明文 + 1 条当前提问
    const userAndAssistantItems = payload.filter((item) => item.role === 'user' || item.role === 'assistant');
    // 10 条历史消息 + 1 条当前提问 = 11 条
    expect(userAndAssistantItems.length).toBe(11);

    // 3. 验证保留的是最新的第 7 至第 16 条消息（最旧的第 1~6 条已被移出明文）
    expect(userAndAssistantItems[0].content).toContain('这是第 7 轮详细讨论内容');
    expect(userAndAssistantItems[9].content).toContain('这是第 16 轮详细讨论内容');
    expect(userAndAssistantItems[10].content).toBe(currentPrompt);
  });

  // =========================================================================
  // d) @ 定向命中
  // =========================================================================
  it('d) @ 定向模式精确解析 Prompt 中的 @ 标签，仅唤醒命中目标，未被 @ 者静默', () => {
    const userMsgMention: Message = {
      id: 'msg-1',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: 'Mobi',
      content: '请 @claude 负责写架构，@deepseek 负责推导复杂度，看看效果如何？',
      createdAt: Date.now(),
    };

    const { targetAgentIds } = engine.initTurn(sampleSession, userMsgMention, 'mention');

    // 精确命中 claude 与 deepseek，未被 @ 的 gpt4o 保持静默
    expect(targetAgentIds).toHaveLength(2);
    expect(targetAgentIds).toContain('claude');
    expect(targetAgentIds).toContain('deepseek');
    expect(targetAgentIds).not.toContain('gpt4o');

    // 测试未输入任何 @ 时的默认降级：回退到首个主导 Agent
    const userMsgNoMention: Message = {
      id: 'msg-2',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: 'Mobi',
      content: '没有包含任何 mention 标签的一般问询',
      createdAt: Date.now(),
    };

    const fallbackResult = engine.initTurn(sampleSession, userMsgNoMention, 'mention');
    expect(fallbackResult.targetAgentIds).toEqual(['claude']);
  });

  // =========================================================================
  // e) 先答者全文对后答者可见（互见上下文集成测试）
  // =========================================================================
  it('e) 先答者作答完毕后，后答者的 Prompt 中应动态包含先答者的全部结论', () => {
    const turnResponses = new Map<string, { agentName: string; content: string }>();
    turnResponses.set('claude', {
      agentName: 'Claude 3.7',
      content: '推荐使用 Tauri v2 + Rust 作为客户端宿主。',
    });

    // 为后答者 deepseek 组装输入
    const payload = engine.assembleForAgent(
      sampleAgents[1], // deepseek
      [],
      '客户端选型讨论',
      turnResponses
    );

    // 验证 payload 中注入了先答者 Claude 的回答
    const peerContext = payload.find(
      (item) => item.role === 'system' && item.content.includes('【本轮会诊同伴实时作答，供协同参考】')
    );
    expect(peerContext).toBeDefined();
    expect(peerContext?.content).toContain('[协同成员 Claude 3.7 已作答]');
    expect(peerContext?.content).toContain('推荐使用 Tauri v2 + Rust 作为客户端宿主。');
  });

  // =========================================================================
  // f) 五大帧协议事件流生命周期验证 (修正版：接入 initTurn 正式开轮)
  // =========================================================================
  it('f) 完整生命周期能按序抛出 typing, chunk, agent_done, usage, turn_done 事件', () => {
    const recordedEvents: string[] = [];
    engine.onEvent((event) => {
      recordedEvents.push(event.type);
    });

    // 1. 先通过引擎门面由用户消息正式开启第 1 轮
    const userMsg: Message = {
      id: 'msg-f',
      sessionId: 'session-101',
      turnIndex: 1,
      senderType: 'user',
      senderId: 'user-01',
      senderName: 'Mobi',
      content: '请启动完整测试流',
      createdAt: Date.now(),
    };
    const { turnIndex } = engine.initTurn(sampleSession, userMsg, 'mention');
    expect(turnIndex).toBe(1);

    // 2. 在合法轮次下模拟完整生命周期流
    engine.notifyTyping('session-101', turnIndex, 'claude', true);
    engine.notifyChunk('session-101', turnIndex, 'claude', '正在生成方案...');
    engine.notifyAgentDone('session-101', turnIndex, 'claude', '最终方案', 150, 300);
    engine.notifyTurnDone('session-101', turnIndex, ['claude'], 450);

    // 3. 验证五大事件全部按序触发，其中 agent_done 伴随抛出 usage 事件
    expect(recordedEvents).toEqual(['typing', 'chunk', 'agent_done', 'usage', 'turn_done']);
  });
});

