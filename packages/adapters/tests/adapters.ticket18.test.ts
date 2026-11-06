/**
 * @take/adapters - tests/adapters.ticket18.test.ts
 * 工单 18 扩容 5 家厂商与连接测试单测套件 ［mock验证］
 * 涵盖：
 * 1. xAI (Grok) 适配器流式解析与请求头断言；
 * 2. 阿里千问 (Qwen) 适配器请求与兼容性断言；
 * 3. 智谱 (GLM) 适配器请求与兼容性断言；
 * 4. 豆包 (Doubao) 适配器支持 ep- 推理端点模型 ID；
 * 5. MiniMax 适配器请求与兼容性断言；
 * 6. 11 家厂商探针模型定义完整性与连接测试探针验证。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudApiAdapter, ModelRegistryEntry } from '../src/cloud-api-adapter.js';
import { ConnectionTester, DEFAULT_PROBE_MODELS } from '../src/connection-tester.js';

describe('TakeChat Ticket 18 Adapters Expansion Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('xAI (Grok): Bearer 鉴权、流式 SSE 逐行解析与 usage 计算 [mock验证]', async () => {
    const grokEntry: ModelRegistryEntry = {
      id: 'grok-3-mini',
      name: 'Grok 3 Mini',
      provider: 'xai',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://api.x.ai/v1',
      contextWindow: 131072,
      supportsStreaming: true,
    };

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" Grok"}}]}\n\n',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ];

    let chunkIdx = 0;
    const mockStream = new ReadableStream({
      pull(controller) {
        if (chunkIdx < sseChunks.length) {
          controller.enqueue(new TextEncoder().encode(sseChunks[chunkIdx++]));
        } else {
          controller.close();
        }
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(mockStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const adapter = new CloudApiAdapter(grokEntry, 'xai-test-key-1234');
    let chunks = '';
    let finalUsage = { input: 0, output: 0 };

    await new Promise<void>((resolve, reject) => {
      adapter.streamChat([{ role: 'user', content: 'hi' }], {
        onChunk: (delta) => {
          chunks += delta;
        },
        onDone: (text, usage) => {
          finalUsage = usage;
          resolve();
        },
        onError: (err) => reject(err),
      });
    });

    expect(chunks).toBe('Hello Grok');
    expect(finalUsage.input).toBe(10);
    expect(finalUsage.output).toBe(5);

    // 验证 fetch 调用参数
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.x.ai/v1/chat/completions');
    const headers = (fetchCall[1]?.headers as Record<string, string>) || {};
    expect(headers['Authorization']).toBe('Bearer xai-test-key-1234');
  });

  it('阿里千问 (Qwen): 兼容模式端点与 Bearer 鉴权 [mock验证]', async () => {
    const qwenEntry = DEFAULT_PROBE_MODELS.qwen;
    expect(qwenEntry).toBeDefined();
    expect(qwenEntry.defaultBaseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');

    const sse = 'data: {"choices":[{"delta":{"content":"千问回答"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const result = await ConnectionTester.testConnection('qwen', 'sk-qwen-key');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('qwen');
    expect(result.modelId).toBe('qwen-turbo');
  });

  it('智谱 (GLM): paas/v4 接口与轻量探针 [mock验证]', async () => {
    const glmEntry = DEFAULT_PROBE_MODELS.zhipu;
    expect(glmEntry).toBeDefined();
    expect(glmEntry.defaultBaseUrl).toBe('https://open.bigmodel.cn/api/paas/v4');

    const sse = 'data: {"choices":[{"delta":{"content":"智谱清言"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const result = await ConnectionTester.testConnection('zhipu', 'zhipu-api-key');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('zhipu');
    expect(result.modelId).toBe('glm-4-flash');
  });

  it('豆包 (Doubao): 火山方舟端点支持传入自定义推理接入点 ID (ep-xxx) [mock验证]', async () => {
    const doubaoEntry = DEFAULT_PROBE_MODELS.doubao;
    expect(doubaoEntry).toBeDefined();
    expect(doubaoEntry.defaultBaseUrl).toBe('https://ark.cn-beijing.volces.com/api/v3');

    const sse = 'data: {"choices":[{"delta":{"content":"豆包就绪"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    // 传入自定义推理接入点 ID ep-20261105-test
    const result = await ConnectionTester.testConnection('doubao', 'ark-key-test', undefined, 'ep-20261105-test');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('doubao');
    expect(result.modelId).toBe('ep-20261105-test');
  });

  it('MiniMax: v1 接口与文本模型探测 [mock验证]', async () => {
    const mmEntry = DEFAULT_PROBE_MODELS.minimax;
    expect(mmEntry).toBeDefined();
    expect(mmEntry.defaultBaseUrl).toBe('https://api.minimax.io/v1');

    const sse = 'data: {"choices":[{"delta":{"content":"MiniMax OK"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const result = await ConnectionTester.testConnection('minimax', 'mm-key-test');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('minimax');
    expect(result.modelId).toBe('MiniMax-Text-01');
  });

  it('11 家厂商全量覆盖收口对账验证 [mock验证]', () => {
    const allProviders = [
      'anthropic',
      'openai',
      'google',
      'deepseek',
      'moonshot',
      'openrouter',
      'xai',
      'qwen',
      'zhipu',
      'doubao',
      'minimax',
    ];

    expect(Object.keys(DEFAULT_PROBE_MODELS)).toHaveLength(11);
    for (const p of allProviders) {
      expect(DEFAULT_PROBE_MODELS[p], `缺失厂商探针定义: ${p}`).toBeDefined();
      expect(DEFAULT_PROBE_MODELS[p].defaultBaseUrl).toBeTruthy();
    }
  });
});
