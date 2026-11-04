/**
 * @take/adapters - cli-adapters.test.ts
 * Vitest 单元测试套件：覆盖本地 CLI 双类适配器（ACP 与 PTY）8 组核心测试 ［mock验证］
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AcpProtocolAdapter,
  AcpProcessHandle,
  PtyCliAdapter,
  HostPtyHandle,
  cleanAnsiText,
} from '../src/index.js';

describe('CLI Adapters Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ACP 握手与流式会话 [mock验证]
  // =========================================================================
  it('ACP: 正常执行 protocolVersion=1 握手并流式分发 session/update 文本 [mock验证]', async () => {
    let stdoutCallback: ((chunk: string) => void) | null = null;
    let writtenFrames: string[] = [];

    const mockHandle: AcpProcessHandle = {
      writeStdin: vi.fn().mockImplementation(async (payload: string) => {
        writtenFrames.push(payload);
        const parsed = JSON.parse(payload.trim());
        if (parsed.method === 'initialize') {
          // 模拟握手成功返回
          setTimeout(() => {
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'Claude CLI' } } }) + '\n');
          }, 10);
        } else if (parsed.method === 'prompt') {
          // 模拟推送流式更新与最终完成响应
          setTimeout(() => {
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { requestId: parsed.id, delta: { text: '编写代码' } } }) + '\n');
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { requestId: parsed.id, delta: { text: '成功' } } }) + '\n');
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: { status: 'complete' } }) + '\n');
          }, 10);
        }
      }),
      onStdout: vi.fn().mockImplementation((cb) => { stdoutCallback = cb; }),
      onStderr: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const spawner = vi.fn().mockResolvedValue(mockHandle);
    const adapter = new AcpProtocolAdapter('acp-claude', spawner);

    const chunks: string[] = [];
    let finalText = '';

    // await sendPrompt 必须等待本轮完全结束 (onDone) 才会 resolve
    await adapter.sendPrompt('优化代码', {
      onChunk: (d) => chunks.push(d),
      onDone: (t) => { finalText = t; },
      onError: (err) => { throw err; },
    });

    // 验证握手报文使用整数 1
    const initRequest = JSON.parse(writtenFrames[0].trim());
    expect(initRequest.params.protocolVersion).toBe(1);

    // 验证流式收集与完成
    expect(chunks.join('')).toBe('编写代码成功');
    expect(finalText).toBe('编写代码成功');
  });

  // =========================================================================
  // 2. ACP 跨分片行缓冲区（断行不丢字） [mock验证]
  // =========================================================================
  it('ACP: 跨分片切断的 JSON 帧自动在行缓冲区中拼接，不丢字 [mock验证]', async () => {
    let stdoutCallback: ((chunk: string) => void) | null = null;

    const mockHandle: AcpProcessHandle = {
      writeStdin: vi.fn().mockImplementation(async (payload: string) => {
        const parsed = JSON.parse(payload.trim());
        if (parsed.method === 'initialize') {
          setTimeout(() => {
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
          }, 5);
        } else if (parsed.method === 'prompt') {
          // 模拟跨分片断开的 JSON 帧
          const p1 = '{"jsonrpc":"2.0","method":"session/update","params":{"delta":{"te';
          const p2 = 'xt":"结构化推理完整接收"}}}\n';
          const p3 = `{"jsonrpc":"2.0","id":${parsed.id},"result":{}}\n`;
          setTimeout(() => {
            stdoutCallback?.(p1);
            setTimeout(() => {
              stdoutCallback?.(p2);
              stdoutCallback?.(p3);
            }, 10);
          }, 5);
        }
      }),
      onStdout: vi.fn().mockImplementation((cb) => { stdoutCallback = cb; }),
      onStderr: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const adapter = new AcpProtocolAdapter('acp-cursor', vi.fn().mockResolvedValue(mockHandle));
    let collected = '';
    let completedText = '';

    await adapter.sendPrompt('测试断行', {
      onChunk: (d) => { collected += d; },
      onDone: (t) => { completedText = t; },
      onError: (err) => { throw err; },
    });

    expect(collected).toBe('结构化推理完整接收');
    expect(completedText).toBe('结构化推理完整接收');
  });

  // =========================================================================
  // 3. ACP 回归：同一实例多轮发问防串扰与无监听泄漏 [mock验证]
  // =========================================================================
  it('ACP 回归: 同一实例连续两次 sendPrompt，两轮 chunk 互不串扰且回调不重复触发 [mock验证]', async () => {
    let stdoutCallback: ((chunk: string) => void) | null = null;
    let onStdoutCallCount = 0;

    const mockHandle: AcpProcessHandle = {
      writeStdin: vi.fn().mockImplementation(async (payload: string) => {
        const parsed = JSON.parse(payload.trim());
        if (parsed.method === 'initialize') {
          setTimeout(() => {
            stdoutCallback?.(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
          }, 5);
        } else if (parsed.method === 'prompt') {
          const text = parsed.params.text;
          setTimeout(() => {
            stdoutCallback?.(JSON.stringify({
              jsonrpc: '2.0',
              method: 'session/update',
              params: { requestId: parsed.id, delta: { text: `[回复:${text}]` } },
            }) + '\n');
            stdoutCallback?.(JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { done: true },
            }) + '\n');
          }, 10);
        }
      }),
      onStdout: vi.fn().mockImplementation((cb) => {
        onStdoutCallCount++;
        stdoutCallback = cb;
      }),
      onStderr: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const adapter = new AcpProtocolAdapter('acp-claude', vi.fn().mockResolvedValue(mockHandle));

    // 第一轮发问
    const round1Chunks: string[] = [];
    let round1Done = '';
    await adapter.sendPrompt('第一轮问题', {
      onChunk: (c) => round1Chunks.push(c),
      onDone: (t) => { round1Done = t; },
      onError: (err) => { throw err; },
    });

    expect(round1Chunks.join('')).toBe('[回复:第一轮问题]');
    expect(round1Done).toBe('[回复:第一轮问题]');

    // 第二轮发问（同一 adapter 实例）
    const round2Chunks: string[] = [];
    let round2Done = '';
    await adapter.sendPrompt('第二轮问题', {
      onChunk: (c) => round2Chunks.push(c),
      onDone: (t) => { round2Done = t; },
      onError: (err) => { throw err; },
    });

    expect(round2Chunks.join('')).toBe('[回复:第二轮问题]');
    expect(round2Done).toBe('[回复:第二轮问题]');

    // 核心断言：第一轮的回调在第二轮时没有被再次触发
    expect(round1Chunks.length).toBe(1);

    // 核心断言：onStdout 监听器只在 initialize 时被绑定了一次，后续发问没有重复监听泄露
    expect(onStdoutCallCount).toBe(1);
  });

  // =========================================================================
  // 4. PTY ANSI 终端字符清洗 [mock验证]
  // =========================================================================
  it('PTY: ANSI 颜色与终端光标移动控制字符被彻底清洗为纯文本 [mock验证]', () => {
    // 包含终端红绿颜色与加粗转义码
    const rawAnsi = '\u001b[1m\u001b[32mCompiling\u001b[0m \u001b[33mtake-core\u001b[0m v0.1.0...\n';
    const clean = cleanAnsiText(rawAnsi);
    expect(clean).toBe('Compiling take-core v0.1.0...\n');

    // 包含光标清除序列
    const cursorAnsi = '\u001b[2K\rDone in 0.42s';
    expect(cleanAnsiText(cursorAnsi)).toBe('\rDone in 0.42s');
  });

  // =========================================================================
  // 5. PTY 白名单强制注入与未授权命令拦截 [mock验证]
  // =========================================================================
  it('PTY 白名单: 传入未在 allowedAliases 名单内的命令，构造函数立即抛错拒绝 [mock验证]', () => {
    const allowed = new Set(['git-cli', 'cargo-cli']);
    expect(() => {
      new PtyCliAdapter('bash', ['-c'], vi.fn(), allowed);
    }).toThrow('未授权的 PTY 命令或别名: [bash]');

    // 验证无默认放行
    expect(() => {
      new PtyCliAdapter('sh', [], vi.fn(), new Set());
    }).toThrow('未授权的 PTY 命令或别名');
  });

  // =========================================================================
  // 6. ACP 白名单强制拦截 [mock验证]
  // =========================================================================
  it('ACP 白名单: 传入未登记的非法命令别名，构造函数立即抛错拒绝拉起 [mock验证]', () => {
    expect(() => {
      new AcpProtocolAdapter('acp-malicious-bash', vi.fn());
    }).toThrow('未授权的 ACP 别名命令');
  });

  // =========================================================================
  // 7. 子进程 spawn 失败错误原样透传 [mock验证]
  // =========================================================================
  it('错误透传: 子进程 spawn 失败时将原始错误信息原样透传，禁止吞没 [mock验证]', async () => {
    const failingSpawner = vi.fn().mockRejectedValue(new Error('ENOENT: 命令未找到'));
    const adapter = new AcpProtocolAdapter('acp-aider', failingSpawner);

    await expect(adapter.initialize()).rejects.toThrow('ENOENT: 命令未找到');
  });

  // =========================================================================
  // 8. 子进程非零退出状态码精确透传（白名单内安全别名） [mock验证]
  // =========================================================================
  it('退出码透传: PTY 进程以非零状态码退出时，错误回调精准携带退出码 [mock验证]', async () => {
    let exitCallback: ((code: number, signal?: string) => void) | null = null;

    const mockPtyHandle: HostPtyHandle = {
      write: vi.fn().mockImplementation(async () => {
        setTimeout(() => {
          // 模拟子进程崩溃返回 137
          exitCallback?.(137, 'SIGKILL');
        }, 10);
      }),
      onData: vi.fn(),
      onExit: vi.fn().mockImplementation((cb) => { exitCallback = cb; }),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const allowed = new Set(['terminal-cli']);
    const adapter = new PtyCliAdapter('terminal-cli', ['-c'], vi.fn().mockResolvedValue(mockPtyHandle), allowed);
    let caughtCode: number | undefined;

    await new Promise<void>((resolve) => {
      adapter.executeSession('exit 137', {
        onChunk: () => {},
        onDone: () => {},
        onError: (_err, exitCode) => {
          caughtCode = exitCode;
          resolve();
        },
      });
    });

    expect(caughtCode).toBe(137);
  });
});
