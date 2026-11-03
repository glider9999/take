/**
 * @take/adapters - acp-cli-adapter.ts
 * 桌面 ACP 协议本地 CLI 智能体适配器（支持 Claude Code ACP, Cursor ACP 等）
 * 严格纪律：仅经 capabilities 白名单内的命令 spawn，握手 protocolVersion 采用整数 1
 */

export interface AcpProcessHandle {
  writeStdin(line: string): Promise<void>;
  onStdout(handler: (line: string) => void): void;
  kill(): Promise<void>;
}

export type ProcessSpawner = (commandName: string, args: string[]) => Promise<AcpProcessHandle>;

// Capabilities 白名单白名单登记命令
const ALLOWED_ACP_COMMANDS = new Set(['acp-claude', 'acp-cursor', 'acp-aider']);

export class AcpCliAdapter {
  private activeHandle: AcpProcessHandle | null = null;
  private messageCounter = 1;

  constructor(
    public readonly commandAlias: string,
    private spawner: ProcessSpawner
  ) {
    if (!ALLOWED_ACP_COMMANDS.has(commandAlias)) {
      throw new Error(`非法的未授权 ACP 命令: ${commandAlias}，必须在 capabilities 白名单中显式登记`);
    }
  }

  public async initialize(): Promise<void> {
    this.activeHandle = await this.spawner(this.commandAlias, ['--acp']);
    
    // 监听子进程输出并发送标准握手帧
    return new Promise((resolve, reject) => {
      if (!this.activeHandle) return reject(new Error('子进程拉起失败'));

      let isHandshakeComplete = false;

      this.activeHandle.onStdout((line) => {
        try {
          const resp = JSON.parse(line.trim());
          if (resp.id === 1 && !isHandshakeComplete) {
            isHandshakeComplete = true;
            resolve();
          }
        } catch {
          // 忽略非 JSON 字符
        }
      });

      // 发送 ACP initialize 握手帧 (protocolVersion 采用整数 1)
      const initFrame = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'TakeChat', version: '1.0.0' },
          protocolVersion: 1,
        },
      };

      this.activeHandle.writeStdin(JSON.stringify(initFrame) + '\n').catch(reject);

      setTimeout(() => {
        if (!isHandshakeComplete) {
          reject(new Error(`ACP 子进程 [${this.commandAlias}] 初始化握手超时 (5s)`));
        }
      }, 5000);
    });
  }

  public async sendMessage(
    prompt: string,
    onChunk: (delta: string) => void,
    onDone: (finalText: string) => void
  ): Promise<void> {
    if (!this.activeHandle) {
      await this.initialize();
    }

    const currentId = ++this.messageCounter;
    let accumulated = '';

    const handleStdout = (line: string) => {
      try {
        const frame = JSON.parse(line.trim());
        if (frame.id === currentId) {
          if (frame.method === 'acp/chunk') {
            const delta = frame.params?.text || '';
            accumulated += delta;
            onChunk(delta);
          } else if (frame.method === 'acp/done' || frame.result) {
            onDone(accumulated);
          }
        }
      } catch {
        // 忽略 ANSI 转义字符
      }
    };

    this.activeHandle?.onStdout(handleStdout);

    const promptFrame = {
      jsonrpc: '2.0',
      id: currentId,
      method: 'prompt',
      params: { text: prompt },
    };

    await this.activeHandle?.writeStdin(JSON.stringify(promptFrame) + '\n');
  }

  public async abort(): Promise<void> {
    if (this.activeHandle) {
      await this.activeHandle.kill();
      this.activeHandle = null;
    }
  }
}

