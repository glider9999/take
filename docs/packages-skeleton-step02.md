# Take Packages Skeleton (engine / adapters / tools)

> 纯前端 TypeScript 实现，零 Node.js 专属 API 依赖（兼容 Browser 与 Tauri Webview）。

---

## 1. packages/engine

### `packages/engine/package.json`
```json
{
  "name": "@take/engine",
  "version": "0.1.0",
  "description": "Take core group chat context orchestration engine",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/ --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### `packages/engine/src/index.ts`
```typescript
/**
 * @take/engine - 核心群聊上下文引擎
 * 职责：会诊路由（广播/@点名/接力）、单轮防死循环调度、历史滑动窗口截断（近 10 条 + 摘要）
 */

export interface Message {
  id: string;
  sessionId: string;
  turnIndex: number;
  senderType: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: number;
}

export interface SessionContext {
  sessionId: string;
  roomId: string;
  history: Message[];
  activeAgentIds: string[];
  maxTurns: number;
  tokenBudget: number;
}

export interface OrchestrationResult {
  turnIndex: number;
  activatedAgentIds: string[];
  trimmedHistory: Message[];
  systemSummary?: string;
}

export class ContextEngine {
  private readonly MAX_HISTORY_MESSAGES = 10;

  /**
   * 裁定单轮激活的 Agent 列表（@定向或全员广播）并修剪历史滑动窗口
   */
  public prepareTurn(
    session: SessionContext,
    userPrompt: string,
    isBroadcast: boolean = false
  ): OrchestrationResult {
    const nextTurn = (session.history[session.history.length - 1]?.turnIndex ?? 0) + 1;
    
    // 1. 路由解析：检测用户输入中的 @Agent 标签
    const mentions = this.extractMentions(userPrompt, session.activeAgentIds);
    let activated = isBroadcast ? [...session.activeAgentIds] : mentions;
    
    // 默认回退至首选 Agent
    if (activated.length === 0 && session.activeAgentIds.length > 0) {
      activated = [session.activeAgentIds[0]];
    }

    // 2. 滑动窗口截断（硬锁最近 10 条）
    const trimmed = session.history.slice(-this.MAX_HISTORY_MESSAGES);

    return {
      turnIndex: nextTurn,
      activatedAgentIds: activated,
      trimmedHistory: trimmed,
      systemSummary: session.history.length > this.MAX_HISTORY_MESSAGES 
        ? '[系统自动摘要] 早期讨论已归档' 
        : undefined,
    };
  }

  private extractMentions(text: string, availableIds: string[]): string[] {
    const matched: string[] = [];
    for (const id of availableIds) {
      if (text.includes(`@${id}`)) {
        matched.push(id);
      }
    }
    return matched;
  }
}
```

---

## 2. packages/adapters

### `packages/adapters/package.json`
```json
{
  "name": "@take/adapters",
  "version": "0.1.0",
  "description": "Take universal contact adapters for cloud APIs and local CLIs",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/ --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### `packages/adapters/src/index.ts`
```typescript
/**
 * @take/adapters - 统一联系人适配总线
 * 职责：抽象 Contact 标准契约，抹平云端 API（OpenAI/Anthropic/Gemini）与本地 CLI（ACP/PTY）差异
 */

export interface StreamChunk {
  agentId: string;
  turnIndex: number;
  deltaText: string;
  isComplete: boolean;
  tokensUsed?: { input: number; output: number };
}

export interface ContactAdapter {
  id: string;
  name: string;
  provider: string;
  streamResponse(
    prompt: string,
    history: Array<{ role: string; content: string }>,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
  abort(): void;
}

export abstract class BaseApiAdapter implements ContactAdapter {
  constructor(
    public id: string,
    public name: string,
    public provider: string,
    protected apiKey: string,
    protected baseUrl?: string
  ) {}

  abstract streamResponse(
    prompt: string,
    history: Array<{ role: string; content: string }>,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;

  abstract abort(): void;
}
```

---

## 3. packages/tools

### `packages/tools/package.json`
```json
{
  "name": "@take/tools",
  "version": "0.1.0",
  "description": "Take local tool dispatcher and ComfyUI workflow bridges",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/ --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### `packages/tools/src/index.ts`
```typescript
/**
 * @take/tools - 本地与外部工具分发器
 * 职责：工具契约注册、ComfyUI 本地环回调用（127.0.0.1:8188）、三级权限边界拦截
 */

export type ToolPermissionLevel = 'level1_readonly' | 'level2_context' | 'level3_destructive';

export interface ToolDefinition {
  name: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parametersSchema: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  toolName: string;
  agentId: string;
  args: Record<string, unknown>;
  requiresUserConfirmation: boolean;
}

export class ToolDispatcher {
  private registeredTools = new Map<string, ToolDefinition>();

  public register(tool: ToolDefinition): void {
    this.registeredTools.set(tool.name, tool);
  }

  public prepareExecution(toolName: string, agentId: string, args: Record<string, unknown>): ToolExecutionRequest {
    const tool = this.registeredTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return {
      toolName,
      agentId,
      args,
      requiresUserConfirmation: tool.permissionLevel === 'level3_destructive',
    };
  }
}
```

