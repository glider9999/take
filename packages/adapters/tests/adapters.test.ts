/**
 * @take/adapters - adapters.test.ts (修复版)
 * Vitest 单元测试套件：6 组全量测试
 * 强化验证：跨网络分片断行拼接（不丢字）、429 退避单点精准透传、KeyStore、ComfyUI 报错回传
 * 纪律遵循：全部基于 Mock Fetch 离线执行，统一标注［mock验证］
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setFetchClient,
  CloudApiAdapter,
  ModelRegistryEntry,
  BrowserKeyStore,
  DesktopKeyStore,
  ComfyUiAdapter,
} from '../src/index.js';

describe('Take Adapters Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Anthropic 流式解析与 opt-in 安全头验证 [mock验证]
  // =========================================================================
  it('Anthropic: 必须携带 opt-in 安全头，并正确解析 content_block_delta 与 usage [mock验证]', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const sseBody = [
      'data: {"type":"message_start","message":{"usage":{"input_tokens":35}}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你好，"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"我是 Claude。"}}\n\n',
      'data: {"type":"message_delta","usage":{"output_tokens":15}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody));
          controller.close();
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });

    setFetchClient(mockFetch);

    const model: ModelRegistryEntry = {
      id: 'claude-3-7-sonnet',
      name: 'Claude 3.7',
      provider: 'anthropic',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://api.anthropic.com/v1',
      contextWindow: 200000,
      supportsStreaming: true,
    };

    const adapter = new CloudApiAdapter(model, 'sk-ant-test');
    const chunks: string[] = [];
    let doneText = '';
    let finalUsage = { input: 0, output: 0 };

    await adapter.streamChat([{ role: 'user', content: '测试问候' }], {
      onChunk: (delta) => chunks.push(delta),
      onDone: (text, usage) => {
        doneText = text;
        finalUsage = usage;
      },
      onError: (err) => { throw err; },
    });

    // 1. 验证 opt-in 头强约束
    expect((capturedHeaders as Record<string, string>)['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect((capturedHeaders as Record<string, string>)['x-api-key']).toBe('sk-ant-test');

    // 2. 验证流式文本聚合与 usage 提取
    expect(chunks.join('')).toBe('你好，我是 Claude。');
    expect(doneText).toBe('你好，我是 Claude。');
    expect(finalUsage.input).toBe(35);
    expect(finalUsage.output).toBe(15);
  });

  // =========================================================================
  // 2. OpenAI 兼容层跨网络分片断行拼接测试（杜绝丢字） [mock验证]
  // =========================================================================
  it('OpenAI兼容层: 跨网络分片未闭合 JSON 自动拼接行缓冲区，完整接收不丢字 [mock验证]', async () => {
    // 模拟恶意/真实网络分片：第二条 JSON 的键名被横跨在两个网络数据包中
    const part1 = 'data: {"choices":[{"delta":{"content":"深度"}}]}\n\ndata: {"choices":[{"delta":{"conte';
    const part2 = 'nt":"思考完成。"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":128,"completion_tokens":45}}\n\ndata: [DONE]\n\n';

    setFetchClient(vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(part1));
        // 延时模拟后续数据片到达
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(part2));
          controller.close();
        }, 10);
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })));

    const model: ModelRegistryEntry = {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1',
      provider: 'deepseek',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://api.deepseek.com',
      contextWindow: 64000,
      supportsStreaming: true,
    };

    const adapter = new CloudApiAdapter(model, 'sk-ds-test');
    let collected = '';
    let parsedUsage = { input: 0, output: 0 };

    await adapter.streamChat([{ role: 'user', content: '推导' }], {
      onChunk: (delta) => { collected += delta; },
      onDone: (text, usage) => { parsedUsage = usage; },
      onError: (err) => { throw err; },
    });

    // 核心断言：残行被成功缓冲拼接，完整收到『深度思考完成。』，不丢『思考完成。』
    expect(collected).toBe('深度思考完成。');
    expect(parsedUsage.input).toBe(128);
    expect(parsedUsage.output).toBe(45);
  });

  // =========================================================================
  // 3. 429 速率限制拦截与 Retry-After 参数单点精准透传 [mock验证]
  // =========================================================================
  it('429 限制: 单点捕获并精准透传 isRateLimit 与 retryAfterSeconds，不被二次覆盖 [mock验证]', async () => {
    setFetchClient(vi.fn().mockResolvedValue(new Response('Rate limit reached', {
      status: 429,
      headers: { 'retry-after': '6' },
    })));

    const model: ModelRegistryEntry = {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://api.openai.com/v1',
      contextWindow: 128000,
      supportsStreaming: true,
    };

    const adapter = new CloudApiAdapter(model, 'sk-openai-test');
    let caught429 = false;
    let retryAfterSec = 0;
    let callCount = 0;

    await adapter.streamChat([{ role: 'user', content: '并发触发' }], {
      onChunk: () => {},
      onDone: () => {},
      onError: (_err, isRateLimit, retryAfter) => {
        callCount++;
        caught429 = Boolean(isRateLimit);
        retryAfterSec = retryAfter || 0;
      },
    });

    // 核心断言：onError 只调用 1 次，且参数完整保留
    expect(callCount).toBe(1);
    expect(caught429).toBe(true);
    expect(retryAfterSec).toBe(6);
  });

  // =========================================================================
  // 4. 用户主动终止生成 (AbortController) [mock验证]
  // =========================================================================
  it('主动终止: 调用 abort() 立即切断流式连接并通知 onError [mock验证]', async () => {
    setFetchClient(vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('AbortError'));
        });
      });
    }));

    const model: ModelRegistryEntry = {
      id: 'openrouter-auto',
      name: 'OpenRouter',
      provider: 'openrouter',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      contextWindow: 128000,
      supportsStreaming: true,
    };

    const adapter = new CloudApiAdapter(model, 'sk-or-test');
    let errorReceived = '';

    const promise = adapter.streamChat([{ role: 'user', content: '长文请求' }], {
      onChunk: () => {},
      onDone: () => {},
      onError: (err) => { errorReceived = err.message; },
    });

    adapter.abort();
    await promise;

    expect(errorReceived).toContain('终止');
  });

  // =========================================================================
  // 5. ComfyUI 适配器提交与节点报错回传 [mock验证]
  // =========================================================================
  it('ComfyUI: 正确提交 prompt 并在节点失败时原样提取返回报错信息 [mock验证]', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'pid-999' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'pid-999': {
          status: {
            status_str: 'error',
            messages: ['LoadCheckPointNode: 找不到 checkpoint 权重模型 v2.safetensors'],
          },
        },
      }), { status: 200 }));

    setFetchClient(mockFetch);

    const comfy = new ComfyUiAdapter('http://127.0.0.1:8188');
    const promptId = await comfy.queuePrompt({ '1': { class_type: 'KSampler' } });
    expect(promptId).toBe('pid-999');

    const result = await comfy.pollHistory('pid-999', 5);
    expect(result.success).toBe(false);
    expect(result.rawError).toContain('LoadCheckPointNode');
    expect(result.rawError).toContain('找不到 checkpoint 权重模型');
  });

  // =========================================================================
  // 6. KeyStore 双语义与数据隔离测试 [mock验证]
  // =========================================================================
  it('KeyStore: 浏览器内存与桌面 IPC 钥匙串双语义独立运转 [mock验证]', async () => {
    const browserStore = new BrowserKeyStore();
    await browserStore.setKey('deepseek', 'sk-browser-ds');
    expect(await browserStore.getKey('deepseek')).toBe('sk-browser-ds');
    await browserStore.deleteKey('deepseek');
    expect(await browserStore.getKey('deepseek')).toBe('');

    const mockTauriVault: Record<string, string> = {};
    const mockInvoker = vi.fn().mockImplementation(async (cmd, args) => {
      if (cmd === 'set_vault_key') {
        mockTauriVault[args.provider] = args.key;
        return null;
      }
      if (cmd === 'get_vault_key') {
        return mockTauriVault[args.provider] || '';
      }
      throw new Error(`未知命令 ${cmd}`);
    });

    const desktopStore = new DesktopKeyStore(mockInvoker);
    await desktopStore.setKey('anthropic', 'sk-desktop-ant');
    expect(mockInvoker).toHaveBeenCalledWith('set_vault_key', { provider: 'anthropic', key: 'sk-desktop-ant' });

    const key = await desktopStore.getKey('anthropic');
    expect(key).toBe('sk-desktop-ant');
  });
});

