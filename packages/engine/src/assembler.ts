/**
 * @take/engine - assembler.ts
 * 上下文组装器：近 10 条明文组装、摘要置顶注入、先答者全文对后答者可见（互见上下文）
 */

import { Message, AgentProfile } from './types.js';
import { ContextCompressor } from './compressor.js';

export interface PromptPayloadItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ContextAssembler {
  constructor(private compressor: ContextCompressor) {}

  /**
   * 为指定 Agent 组装发送给大模型 API 的完整 Prompt 报文
   * @param agent 当前正在准备输入的智能体档案
   * @param sessionHistory 会话历史记录
   * @param currentTurnUserMessage 当前轮次的用户输入
   * @param turnCompletedResponses 本轮中已完成回答的其他先答者回复（agentId -> content 映射）
   */
  public assemblePrompt(
    agent: AgentProfile,
    sessionHistory: Message[],
    currentTurnUserMessage: string,
    turnCompletedResponses: Map<string, { agentName: string; content: string }> = new Map()
  ): PromptPayloadItem[] {
    const payload: PromptPayloadItem[] = [];

    // 1. 注入 Agent 专属 System Prompt
    let systemInstruction = agent.systemPrompt.trim();

    // 2. 注入历史摘要（若历史超过 10 条被滑动截断）
    const { retained, overflow } = this.compressor.sliceHistory(sessionHistory);
    if (overflow.length > 0) {
      const summaryText = this.compressor.buildStructuredSummary(overflow);
      if (summaryText) {
        systemInstruction += `\n\n${summaryText}`;
      }
    }
    payload.push({ role: 'system', content: systemInstruction });

    // 3. 注入最近 10 条明文历史
    for (const msg of retained) {
      if (msg.senderType === 'user') {
        payload.push({ role: 'user', content: msg.content });
      } else if (msg.senderType === 'agent') {
        // 多 Agent 群聊中，标明具体发信者昵称，维持群聊语境
        payload.push({
          role: 'assistant',
          content: `[${msg.senderName}]: ${msg.content}`,
        });
      }
    }

    // 4. 组装当前轮次用户发问
    payload.push({ role: 'user', content: currentTurnUserMessage });

    // 5. 核心手艺：先答者全文对后答者动态可见（互见上下文）
    if (turnCompletedResponses.size > 0) {
      const peerInsights: string[] = [];
      for (const [peerId, peer] of turnCompletedResponses.entries()) {
        if (peerId !== agent.id) {
          peerInsights.push(`[协同成员 ${peer.agentName} 已作答]:\n${peer.content}`);
        }
      }
      if (peerInsights.length > 0) {
        payload.push({
          role: 'system',
          content: `【本轮会诊同伴实时作答，供协同参考】\n${peerInsights.join('\n\n')}`,
        });
      }
    }

    return payload;
  }
}

