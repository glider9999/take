/**
 * @take/engine - scheduler.ts
 * 调度器：三模式路由、只有用户消息开新轮、单轮每人至多一答、429 退避策略、超时与主动停止
 */

import { Message, Session, DispatchMode } from './types.js';

export interface SchedulerPolicy {
  maxAgentTimeoutMs: number;
  maxRetryAttempts: number;
  initialBackoffMs: number;
}

export const DEFAULT_SCHEDULER_POLICY: SchedulerPolicy = {
  maxAgentTimeoutMs: 60000, // 单 Agent 超时 60s
  maxRetryAttempts: 3,      // 429 退避最大重试 3 次
  initialBackoffMs: 1000,   // 初始退避 1 秒
};

export class TurnScheduler {
  private policy: SchedulerPolicy;
  private currentTurnIndex = 0;
  private respondedAgentsInCurrentTurn = new Set<string>();
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(policy: Partial<SchedulerPolicy> = {}) {
    this.policy = { ...DEFAULT_SCHEDULER_POLICY, ...policy };
  }

  /**
   * 开启新轮次：【核心纪律一】只有用户发信方可开启新轮次
   */
  public startNewTurn(session: Session, triggerMessage: Message): number {
    if (triggerMessage.senderType !== 'user') {
      throw new Error('Only user messages can initiate a new turn');
    }

    if (session.isClosed) {
      throw new Error('Cannot start a turn in a closed session');
    }

    // 轮次号自增并清空当前轮答复记录
    this.currentTurnIndex = (session.history[session.history.length - 1]?.turnIndex ?? 0) + 1;
    this.respondedAgentsInCurrentTurn.clear();
    this.activeAbortControllers.clear();

    return this.currentTurnIndex;
  }

  /**
   * 路由裁定：根据模式和用户输入解析本轮激活的 Agent 列表
   */
  public resolveTargetAgents(
    userPrompt: string,
    availableAgentIds: string[],
    mode: DispatchMode = 'mention'
  ): string[] {
    if (availableAgentIds.length === 0) return [];

    if (mode === 'broadcast') {
      return [...availableAgentIds];
    }

    if (mode === 'single') {
      return [availableAgentIds[0]];
    }

    // mention 模式：提取用户输入中的 @AgentId
    const mentions = this.extractMentions(userPrompt, availableAgentIds);
    if (mentions.length > 0) {
      return mentions;
    }

    // 未显式 @ 任何人时，默认回退至首个主导 Agent
    return [availableAgentIds[0]];
  }

  /**
   * 登记 Agent 作答：【核心纪律二】每轮每 Agent 至多作答一次
   */
  public registerAgentResponse(agentId: string, turnIndex: number): void {
    if (turnIndex !== this.currentTurnIndex) {
      throw new Error(`Turn mismatch: current turn is ${this.currentTurnIndex}, got ${turnIndex}`);
    }

    if (this.respondedAgentsInCurrentTurn.has(agentId)) {
      throw new Error(`Agent ${agentId} has already responded in turn ${turnIndex}`);
    }

    this.respondedAgentsInCurrentTurn.add(agentId);
  }

  /**
   * 校验某个 Agent 是否可在当前轮作答
   */
  public canAgentRespond(agentId: string, turnIndex: number): boolean {
    return turnIndex === this.currentTurnIndex && !this.respondedAgentsInCurrentTurn.has(agentId);
  }

  /**
   * 429 频率限制指数退避计算
   */
  public calculateBackoffMs(attempt: number, retryAfterHeader?: number): number {
    if (retryAfterHeader && retryAfterHeader > 0) {
      return retryAfterHeader * 1000;
    }
    const backoff = this.policy.initialBackoffMs * Math.pow(2, attempt);
    // 加入随机抖动 (Jitter)
    const jitter = Math.random() * 500;
    return Math.min(backoff + jitter, 30000); // 最大退避上限 30s
  }

  /**
   * 为单次 Agent 请求绑定 AbortController
   */
  public createAbortSignal(agentId: string): AbortSignal {
    const controller = new AbortController();
    this.activeAbortControllers.set(agentId, controller);
    return controller.signal;
  }

  /**
   * 用户主动终止单 Agent 或全轮请求
   */
  public abort(agentId?: string): void {
    if (agentId) {
      const controller = this.activeAbortControllers.get(agentId);
      if (controller) {
        controller.abort();
        this.activeAbortControllers.delete(agentId);
      }
    } else {
      // 终止当前轮全员
      for (const controller of this.activeAbortControllers.values()) {
        controller.abort();
      }
      this.activeAbortControllers.clear();
    }
  }

  public getCurrentTurnIndex(): number {
    return this.currentTurnIndex;
  }

  private extractMentions(text: string, validIds: string[]): string[] {
    const matched: string[] = [];
    for (const id of validIds) {
      // 匹配 @id 边界
      const regex = new RegExp(`@${id}\\b`, 'i');
      if (regex.test(text)) {
        matched.push(id);
      }
    }
    return matched;
  }
}

