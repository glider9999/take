/**
 * @take/adapters - tests/adapters.ticket19.test.ts
 * 工单 19 新增 NVIDIA 适配器单测套件 ［mock验证］
 * 涵盖：
 * 1. NVIDIA API 目录（integrate.api.nvidia.com）Bearer 鉴权与 OpenAI 兼容流式请求；
 * 2. 探针模型（meta/llama-3.1-8b-instruct）连接测试与轻量指令模型验证；
 * 3. 12 家厂商全量覆盖收口对账验证。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudApiAdapter, ModelRegistryEntry } from '../src/cloud-api-adapter.js';
import { ConnectionTester, DEFAULT_PROBE_MODELS } from '../src/connection-tester.js';

describe('TakeChat Ticket 19 NVIDIA Adapter Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('NVIDIA (nvapi-): Bearer 鉴权、integrate.api.nvidia.com 端点与流式 SSE 逐行解析 [mock验证]', async () => {
    const nvidiaEntry: ModelRegistryEntry = {
      id: 'meta/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct (NVIDIA)',
      provider: 'nvidia',
      driverType: 'cloud_api',
      defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
      contextWindow: 131072,
      supportsStreaming: true,
    };

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" from NVIDIA"}}]}\n\n',
      'data: {"usage":{"prompt_tokens":12,"completion_tokens":6}}\n\n',
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

    const adapter = new CloudApiAdapter(nvidiaEntry, 'nvapi-test-key-1234');
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

    expect(chunks).toBe('Hello from NVIDIA');
    expect(finalUsage.input).toBe(12);
    expect(finalUsage.output).toBe(6);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    const headers = (fetchCall[1]?.headers as Record<string, string>) || {};
    expect(headers['Authorization']).toBe('Bearer nvapi-test-key-1234');
  });

  it('NVIDIA 连接测试探针：meta/llama-3.1-8b-instruct 最小探针检测 [mock验证]', async () => {
    const nvEntry = DEFAULT_PROBE_MODELS.nvidia;
    expect(nvEntry).toBeDefined();
    expect(nvEntry.defaultBaseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(nvEntry.id).toBe('meta/llama-3.1-8b-instruct');

    const sse = 'data: {"choices":[{"delta":{"content":"NVIDIA OK"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(sse, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const result = await ConnectionTester.testConnection('nvidia', 'nvapi-live-probe-key');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('nvidia');
    expect(result.modelId).toBe('meta/llama-3.1-8b-instruct');
  });

  it('12 家厂商全量覆盖收口对账验证 [mock验证]', () => {
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
      'nvidia',
    ];

    expect(Object.keys(DEFAULT_PROBE_MODELS)).toHaveLength(12);
    for (const p of allProviders) {
      expect(DEFAULT_PROBE_MODELS[p], `缺失厂商探针定义: ${p}`).toBeDefined();
      expect(DEFAULT_PROBE_MODELS[p].defaultBaseUrl).toBeTruthy();
    }
  });
});
