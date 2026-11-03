/**
 * @take/engine - engine.ts
 * ContextEngine 主入口：整合调度器、组装器、压缩器与五大事件流分发
 */

import {
  Message,
  Session,
  AgentProfile,
  DispatchMode,
  EngineEvent,
  TypingEvent,
  ChunkEvent,
  AgentDoneEvent,
  TurnDoneEvent,
  UsageEvent,
} from './types.js';
import { ContextCompressor, DEFAULT_COMPRESSOR_CONFIG } from './compressor.js';
import { ContextAssembler, PromptPayloadItem } from './assembler.js';
import { TurnScheduler, DEFAULT_SCHEDULER_POLICY } from './scheduler.js';

export type EventListener = (event: EngineEvent) => void;

export class ContextEngine {
  private compressor: ContextCompressor;
  private assembler: ContextAssembler;
  private scheduler: TurnScheduler;
  private eventListeners: Set<EventListener> = new Set();

  constructor(
    compressorConfig = DEFAULT_COMPRESSOR_CONFIG,
    schedulerPolicy = DEFAULT_SCHEDULER_POLICY
  ) {
    this.compressor = new ContextCompressor(compressorConfig);
    this.assembler = new ContextAssembler(this.compressor);
    this.scheduler = new TurnScheduler(schedulerPolicy);
  }

  /**
   * 注册帧事件监听器
   */
  public onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * 广播帧事件
   */
  public emitEvent(event: EngineEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in engine event listener:', err);
      }
    }
  }

  /**
   * 准备并启动新一轮会诊
   */
  public initTurn(
    session: Session,
    userMessage: Message,
    mode: DispatchMode = 'mention'
  ): {
    turnIndex: number;
    targetAgentIds: string[];
  } {
    // 强制校验：只有用户发信可开新轮
    const turnIndex = this.scheduler.startNewTurn(session, userMessage);
    const targetAgentIds = this.scheduler.resolveTargetAgents(
      userMessage.content,
      session.activeAgentIds,
      mode
    );

    return { turnIndex, targetAgentIds };
  }

  /**
   * 为某个 Agent 组装发送给 API 的 Prompt Payload（支持动态互见）
   */
  public assembleForAgent(
    agent: AgentProfile,
    sessionHistory: Message[],
    userPrompt: string,
    turnCompletedResponses: Map<string, { agentName: string; content: string }> = new Map()
  ): PromptPayloadItem[] {
    return this.assembler.assemblePrompt(
      agent,
      sessionHistory,
      userPrompt,
      turnCompletedResponses
    );
  }

  /**
   * 登记 Agent 启动打字态
   */
  public notifyTyping(sessionId: string, turnIndex: number, agentId: string, isTyping: boolean): void {
    const event: TypingEvent = {
      type: 'typing',
      sessionId,
      turnIndex,
      agentId,
      isTyping,
      timestamp: Date.now(),
    };
    this.emitEvent(event);
  }

  /**
   * 推送增量流式 Chunk
   */
  public notifyChunk(sessionId: string, turnIndex: number, agentId: string, deltaText: string): void {
    const event: ChunkEvent = {
      type: 'chunk',
      sessionId,
      turnIndex,
      agentId,
      deltaText,
      timestamp: Date.now(),
    };
    this.emitEvent(event);
  }

  /**
   * 登记单 Agent 完成
   */
  public notifyAgentDone(
    sessionId: string,
    turnIndex: number,
    agentId: string,
    finalContent: string,
    tokensIn: number,
    tokensOut: number,
    status: 'success' | 'aborted' | 'error' | 'timeout' = 'success',
    error?: string
  ): void {
    // 登记调度器：每人至多一答
    this.scheduler.registerAgentResponse(agentId, turnIndex);

    const doneEvent: AgentDoneEvent = {
      type: 'agent_done',
      sessionId,
      turnIndex,
      agentId,
      finalContent,
      tokensIn,
      tokensOut,
      status,
      error,
      timestamp: Date.now(),
    };
    this.emitEvent(doneEvent);

    // 抛出 usage 事件供本地财务账本独立消费
    const usageEvent: UsageEvent = {
      type: 'usage',
      sessionId,
      turnIndex,
      agentId,
      usage: {
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        totalTokens: tokensIn + tokensOut,
      },
      timestamp: Date.now(),
    };
    this.emitEvent(usageEvent);
  }

  /**
   * 登记整轮闭环完成
   */
  public notifyTurnDone(
    sessionId: string,
    turnIndex: number,
    completedAgentIds: string[],
    totalTurnTokens: number
  ): void {
    const event: TurnDoneEvent = {
      type: 'turn_done',
      sessionId,
      turnIndex,
      completedAgentIds,
      totalTurnTokens,
      timestamp: Date.now(),
    };
    this.emitEvent(event);
  }

  /**
   * 用户主动终止生成
   */
  public abortTurn(agentId?: string): void {
    this.scheduler.abort(agentId);
  }

  public getScheduler(): TurnScheduler {
    return this.scheduler;
  }

  public getCompressor(): ContextCompressor {
    return this.compressor;
  }
}

