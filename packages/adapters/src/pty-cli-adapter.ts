/**
 * @take/adapters - pty-cli-adapter.ts
 * 本地老式非 ACP 命令行工具伪终端（PTY）包装适配器
 * 核心特性：
 * 1. 纯前端 TS 抽象，通过 HostBridge 接口与桌面/宿主解耦；
 * 2. 构造参数强注入 allowedAliases: Set<string> 白名单，无默认放行；
 * 3. 深度 ANSI 转义字符清洗（过滤终端颜色、光标控制、样式字符）；
 * 4. 进程退出码与信号无损透传。
 */

export interface HostPtyHandle {
  write(data: string): Promise<void>;
  onData(listener: (raw: string) => void): void;
  onExit(listener: (code: number, signal?: string) => void): void;
  kill(signal?: string): Promise<void>;
}

export type HostPtyBridge = (command: string, args: string[]) => Promise<HostPtyHandle>;

/**
 * ANSI 转义字符强力清洗器：去除终端颜色高亮、光标定位、擦除控制码等
 */
export function cleanAnsiText(input: string): string {
  if (!input) return '';
  // 覆盖标准 SGR 序列、光标移动序列与 OSC 终端标题序列
  const ansiRegex =
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return input.replace(ansiRegex, '');
}

export interface PtySessionCallbacks {
  onChunk: (sanitizedText: string) => void;
  onDone: (fullText: string, exitCode: number) => void;
  onError: (error: Error, exitCode?: number) => void;
}

export class PtyCliAdapter {
  private activeHandle: HostPtyHandle | null = null;
  private isRunning = false;

  constructor(
    public readonly command: string,
    public readonly defaultArgs: string[] = [],
    private ptyBridge: HostPtyBridge,
    public readonly allowedAliases: Set<string>
  ) {
    if (!allowedAliases || !allowedAliases.has(command)) {
      throw new Error(`未授权的 PTY 命令或别名: [${command}]，已被白名单拦截拒绝`);
    }
  }

  /**
   * 启动 PTY 会话并发送输入文本
   */
  public async executeSession(
    inputText: string,
    callbacks: PtySessionCallbacks
  ): Promise<void> {
    try {
      this.activeHandle = await this.ptyBridge(this.command, this.defaultArgs);
      this.isRunning = true;
    } catch (err) {
      callbacks.onError(new Error(`PTY 进程拉起失败 [${this.command}]: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }

    let accumulatedClean = '';

    this.activeHandle.onData((data: string) => {
      const cleanChunk = cleanAnsiText(data);
      if (cleanChunk) {
        accumulatedClean += cleanChunk;
        callbacks.onChunk(cleanChunk);
      }
    });

    this.activeHandle.onExit((code: number, signal?: string) => {
      this.isRunning = false;
      this.activeHandle = null;

      if (code === 0) {
        callbacks.onDone(accumulatedClean, 0);
      } else {
        callbacks.onError(
          new Error(`PTY 进程异常终止，退出码: ${code}${signal ? ` (信号: ${signal})` : ''}`),
          code
        );
      }
    });

    // 将输入内容写入 PTY 标准输入
    await this.activeHandle.write(inputText + '\n');
  }

  public async abort(): Promise<void> {
    if (this.activeHandle && this.isRunning) {
      await this.activeHandle.kill('SIGINT');
      this.isRunning = false;
      this.activeHandle = null;
    }
  }
}
