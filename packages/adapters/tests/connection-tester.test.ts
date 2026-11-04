/**
 * @take/adapters - connection-tester.test.ts
 * Vitest 单元测试套件：验证六大厂商联调自检逻辑 ［mock验证］
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionTester, setFetchClient } from '../src/index.js';

describe('ConnectionTester Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('成功连通自检：收到首个 chunk 即返回成功并统计耗时 [mock验证]', async () => {
    const sseChunk = 'data: {"choices":[{"delta":{"content":"pong"}}]}\n\n';
    setFetchClient(vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseChunk));
        controller.close();
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })));

    const result = await ConnectionTester.testConnection('openai', 'sk-test-valid');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-4o');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.errorMessage).toBeUndefined();
  });

  it('429 速率限制自检：透传 isRateLimit 与 retryAfterSeconds，不吞没状态 [mock验证]', async () => {
    setFetchClient(vi.fn().mockResolvedValue(new Response('Rate limit exceeded', {
      status: 429,
      headers: { 'retry-after': '5' },
    })));

    const result = await ConnectionTester.testConnection('deepseek', 'sk-test-429');
    expect(result.success).toBe(false);
    expect(result.provider).toBe('deepseek');
    expect(result.isRateLimit).toBe(true);
    expect(result.retryAfterSeconds).toBe(5);
    expect(result.errorMessage).toContain('429');
  });

  it('401 密钥失效自检：原样返回 API 报错文本，禁止吞没错误 [mock验证]', async () => {
    setFetchClient(vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Incorrect API key provided' } }),
      { status: 401 }
    )));

    const result = await ConnectionTester.testConnection('moonshot', 'sk-invalid-key');
    expect(result.success).toBe(false);
    expect(result.provider).toBe('moonshot');
    expect(result.errorMessage).toContain('401');
    expect(result.errorMessage).toContain('Incorrect API key provided');
  });

  it('未提供 Key：提前拦截提示，不发起网络请求 [mock验证]', async () => {
    const fetchMock = vi.fn();
    setFetchClient(fetchMock);

    const result = await ConnectionTester.testConnection('google', '');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('未配置 API Key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Anthropic 自检探针：断言必带 opt-in 安全头 [mock验证]', async () => {
    let capturedHeaders: HeadersInit | undefined;
    setFetchClient(vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"message_start"}\n\n'));
          controller.close();
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }));

    const result = await ConnectionTester.testConnection('anthropic', 'sk-ant-test');
    expect(result.success).toBe(true);
    expect((capturedHeaders as Record<string, string>)['anthropic-dangerous-direct-browser-access']).toBe('true');
  });
});
