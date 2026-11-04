/**
 * @take/adapters - acp-protocol-adapter.ts
 * 本地 ACP 协议结构化智能体适配器（标准 JSON-RPC 2.0 over stdio）
 * 严格纪律：
 * 1. 握手 protocolVersion 使用整数 1；
 * 2. 跨分片行缓冲区（buffer），断行不丢字；
 * 3. 严格 capabilities 白名单别名管控（acp-claude/cursor/aider），禁止任意 shell 命令；
 * 4. 监听器只在 initialize 注册一次，按 requestId 派发，彻底杜绝多轮串话；
 * 5. sendPrompt 语义对齐：Promise 在本轮 onDone 时 resolve、onError 时 reject；
 * 6. 异常与非零退出状态码原样透传，不吞没错误。
 */

export interface AcpProcessHandle {
  writeStdin(payload: string): Promise<void>;
  onStdout(listener: (chunk: string) => void): void;
  onStderr(listener: (chunk: string) => void): void;
  onExit(listener: (code: number, signal?: string) => void): void;
  kill(signal?: string): Promise<void>;
}

export type AcpSpawner = (alias: string, args: string[]) => Promise<AcpProcessHandle>;

export const ALLOWED_ACP_ALIASES = new Set(['acp-claude', 'acp-cursor', 'acp-aider']);

export interface AcpSessionCallbacks {
  onChunk: (delta: string) => void;
  onDone: (finalText: string) => void;
  onError: (error: Error, exitCode?: number) => void;
}

interface PendingRequest {
  callbacks: AcpSessionCallbacks;
  resolve: () => void;
  reject: (err: Error) => void;
  accumulatedText: string;
}

export class AcpProtocolAdapter {
  private activeHandle: AcpProcessHandle | null = null;
  private lineBuffer = '';
  private currentRequestId = 1;
  private isInitialized = false;
  private activePromptRequestId: number | null = null;
  private pendingRequests = new Map<number, PendingRequest>();

  constructor(
    public readonly commandAlias: string,
    private spawner: AcpSpawner
  ) {
    if (!ALLOWED_ACP_ALIASES.has(commandAlias)) {
      throw new Error(`未授权的 ACP 别名命令: [${commandAlias}]，已被 capabilities 白名单拒绝`);
    }
  }

  /**
   * 拉起子进程并执行 JSON-RPC 2.0 握手
   * 严格要求：stdout/stderr/exit 监听器仅在此处注册一次
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized && this.activeHandle) {
      return;
    }

    try {
      this.activeHandle = await this.spawner(this.commandAlias, ['--acp']);
    } catch (err) {
      throw new Error(`拉起 ACP 子进程 [${this.commandAlias}] 失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.activeHandle) return reject(new Error('子进程句柄为空'));

      const timeoutTimer = setTimeout(() => {
        if (!this.isInitialized) {
          this.abort();
          reject(new Error(`ACP 子进程 [${this.commandAlias}] 握手超时 (5s)`));
        }
      }, 5000);

      // 单次绑定 stdout 监听器：负责分发握手与流式请求
      this.activeHandle.onStdout((rawChunk: string) => {
        this.processStdoutLines(rawChunk, (frame) => {
          // 1. 处理握手响应 (id: 1)
          if (frame.id === 1) {
            if (frame.result || frame.method === 'initialize/response') {
              this.isInitialized = true;
              clearTimeout(timeoutTimer);
              resolve();
              return;
            } else if (frame.error) {
              clearTimeout(timeoutTimer);
              reject(new Error(`ACP 握手失败: ${JSON.stringify(frame.error)}`));
              return;
            }
          }

          // 2. 处理流式通知 (session/update 或 acp/chunk)
          if (frame.method === 'session/update' || frame.method === 'acp/chunk') {
            const reqId = frame.params?.requestId ?? frame.params?.id ?? this.activePromptRequestId;
            const pending = reqId ? this.pendingRequests.get(reqId) : null;
            if (pending) {
              const delta = frame.params?.delta?.text || frame.params?.text || '';
              if (delta) {
                pending.accumulatedText += delta;
                pending.callbacks.onChunk(delta);
              }
            }
            return;
          }

          // 3. 处理请求应答完成或错误 (由 requestId 寻址)
          if (typeof frame.id === 'number' && this.pendingRequests.has(frame.id)) {
            const pending = this.pendingRequests.get(frame.id)!;
            this.pendingRequests.delete(frame.id);
            if (this.activePromptRequestId === frame.id) {
              this.activePromptRequestId = null;
            }

            if (frame.error) {
              const err = new Error(`ACP 执行报错 [${frame.error.code || 'UNKNOWN'}]: ${frame.error.message || JSON.stringify(frame.error)}`);
              pending.callbacks.onError(err);
              pending.reject(err);
            } else {
              pending.callbacks.onDone(pending.accumulatedText);
              pending.resolve();
            }
          }
        });
      });

      // 单次绑定 stderr 监听器
      this.activeHandle.onStderr((errChunk: string) => {
        if (errChunk.trim()) {
          console.warn(`[ACP ${this.commandAlias} stderr]:`, errChunk.trim());
        }
      });

      // 单次绑定 exit 监听器
      this.activeHandle.onExit((code, signal) => {
        if (!this.isInitialized) {
          clearTimeout(timeoutTimer);
          reject(new Error(`ACP 子进程在握手前异常退出，退出码: ${code}, 信号: ${signal || 'none'}`));
          return;
        }

        const isAbnormal = code !== 0 && code !== null;
        if (isAbnormal || this.pendingRequests.size > 0) {
          const err = new Error(`ACP 子进程异常终止，退出码: ${code}${signal ? ` (信号: ${signal})` : ''}`);
          for (const pending of this.pendingRequests.values()) {
            pending.callbacks.onError(err, code ?? undefined);
            pending.reject(err);
          }
          this.pendingRequests.clear();
          this.activePromptRequestId = null;
        }
      });

      // 发送 ACP 规范握手请求 (protocolVersion 采用整数 1)
      const initPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'TakeChat', version: '1.0.0' },
          protocolVersion: 1,
        },
      };

      this.activeHandle.writeStdin(JSON.stringify(initPayload) + '\n').catch((err) => {
        clearTimeout(timeoutTimer);
        reject(err);
      });
    });
  }

  /**
   * 发送 Prompt 并等待本轮回答完全结束
   * 返回的 Promise 在 onDone 时 resolve，在 onError 时 reject
   */
  public async sendPrompt(
    promptText: string,
    callbacks: AcpSessionCallbacks
  ): Promise<void> {
    if (!this.activeHandle || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.activeHandle) {
      const err = new Error('子进程未就绪');
      callbacks.onError(err);
      throw err;
    }

    const requestId = ++this.currentRequestId;
    this.activePromptRequestId = requestId;

    return new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        callbacks,
        resolve,
        reject,
        accumulatedText: '',
      });

      const promptPayload = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'prompt',
        params: { text: promptText },
      };

      this.activeHandle!.writeStdin(JSON.stringify(promptPayload) + '\n').catch((err) => {
        this.pendingRequests.delete(requestId);
        if (this.activePromptRequestId === requestId) {
          this.activePromptRequestId = null;
        }
        const wrappedErr = err instanceof Error ? err : new Error(String(err));
        callbacks.onError(wrappedErr);
        reject(wrappedErr);
      });
    });
  }

  /**
   * 发送取消请求并安全终止
   */
  public async cancel(requestId?: number): Promise<void> {
    const targetId = requestId || this.activePromptRequestId || this.currentRequestId;
    if (this.activeHandle && this.isInitialized) {
      const cancelPayload = {
        jsonrpc: '2.0',
        method: 'cancel',
        params: { id: targetId },
      };
      await this.activeHandle.writeStdin(JSON.stringify(cancelPayload) + '\n').catch(() => {});
    }
  }

  /**
   * 强杀终止进程
   */
  public async abort(): Promise<void> {
    if (this.activeHandle) {
      await this.activeHandle.kill('SIGTERM').catch(() => {});
      this.activeHandle = null;
      this.isInitialized = false;
      this.lineBuffer = '';
      this.activePromptRequestId = null;
      const abortErr = new Error('进程已主动终止 (abort)');
      for (const pending of this.pendingRequests.values()) {
        pending.callbacks.onError(abortErr);
        pending.reject(abortErr);
      }
      this.pendingRequests.clear();
    }
  }

  /**
   * 跨分片行缓冲区拆解：严格保证只把完整换行的 JSON 帧交给解析器
   */
  private processStdoutLines(
    rawChunk: string,
    onFrame: (frame: Record<string, any>) => void
  ): void {
    this.lineBuffer += rawChunk;
    const lines = this.lineBuffer.split('\n');
    // 弹出末尾未闭合的残余行
    this.lineBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const frame = JSON.parse(trimmed);
        onFrame(frame);
      } catch {
        // 容忍非 JSON 杂质输出
      }
    }
  }
}
