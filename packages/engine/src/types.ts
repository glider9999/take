/**
 * @take/engine - types.ts
 * 核心数据模型与五类标准帧协议事件定义（纯前端 TS，零外部依赖）
 */

export type SenderType = 'user' | 'agent' | 'system';

export type DispatchMode = 'single' | 'mention' | 'broadcast';

export interface Message {
  id: string;
  sessionId: string;
  turnIndex: number;
  senderType: SenderType;
  senderId: string;
  senderName: string;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  avatar?: string;
  systemPrompt: string;
  provider: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Session {
  id: string;
  roomId: string;
  title: string;
  history: Message[];
  activeAgentIds: string[];
  tokenBudget: number;
  totalTokensUsed: number;
  isClosed: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

// ==================== 五大标准帧协议事件 ====================

export interface TypingEvent {
  type: 'typing';
  sessionId: string;
  turnIndex: number;
  agentId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface ChunkEvent {
  type: 'chunk';
  sessionId: string;
  turnIndex: number;
  agentId: string;
  deltaText: string;
  timestamp: number;
}

export interface AgentDoneEvent {
  type: 'agent_done';
  sessionId: string;
  turnIndex: number;
  agentId: string;
  finalContent: string;
  tokensIn: number;
  tokensOut: number;
  status: 'success' | 'aborted' | 'error' | 'timeout';
  error?: string;
  timestamp: number;
}

export interface TurnDoneEvent {
  type: 'turn_done';
  sessionId: string;
  turnIndex: number;
  completedAgentIds: string[];
  totalTurnTokens: number;
  timestamp: number;
}

export interface UsageEvent {
  type: 'usage';
  sessionId: string;
  turnIndex: number;
  agentId: string;
  usage: TokenUsage;
  timestamp: number;
}

export type EngineEvent = 
  | TypingEvent 
  | ChunkEvent 
  | AgentDoneEvent 
  | TurnDoneEvent 
  | UsageEvent;

export interface StructuredSummary {
  background: string;
  keyFindings: string;
  decisions: string;
  codeOrData: string;
}

