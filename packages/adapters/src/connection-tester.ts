/**
 * @take/adapters - connection-tester.ts
 * 六大厂商 API 联调自检器（用于设置面板「测试连接」）
 * 严格纪律：
 * 1. 发送最小请求（ping），耗时精确统计；
 * 2. 失败时完整透传原始错误信息全文，禁止吞没错误；
 * 3. 429 走 RateLimitError 专门透传 isRateLimit 与 retryAfterSeconds；
 * 4. 纯净独立：不进入聊天消息流、不产生账本 usage 记录。
 */

import { CloudApiAdapter, ModelRegistryEntry, RateLimitError } from './cloud-api-adapter.js';

export interface ConnectionTestResult {
  provider: string;
  modelId: string;
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
  isRateLimit?: boolean;
  retryAfterSeconds?: number;
}

// 六大厂商联调自检默认最小模型探针定义（读取自注册表标准口径）
export const DEFAULT_PROBE_MODELS: Record<string, ModelRegistryEntry> = {
  anthropic: {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    contextWindow: 200000,
    supportsStreaming: true,
    requiredHeaders: {
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-version': '2023-06-01',
    },
  },
  openai: {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.openai.com/v1',
    contextWindow: 128000,
    supportsStreaming: true,
  },
  google: {
    id: 'gemini-2-0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    contextWindow: 1048576,
    supportsStreaming: true,
  },
  deepseek: {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.deepseek.com',
    contextWindow: 64000,
    supportsStreaming: true,
  },
  moonshot: {
    id: 'moonshot-v1-32k',
    name: 'Kimi Moonshot v1',
    provider: 'moonshot',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    contextWindow: 32000,
    supportsStreaming: true,
  },
  openrouter: {
    id: 'openrouter-auto',
    name: 'OpenRouter Auto Router',
    provider: 'openrouter',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    contextWindow: 128000,
    supportsStreaming: true,
    requiredHeaders: {
      'HTTP-Referer': 'https://take.hk',
      'X-Title': 'Take Client Test',
    },
  },
};

export class ConnectionTester {
  /**
   * 测试指定厂商的 API 连接可用性
   */
  public static async testConnection(
    provider: string,
    apiKey: string,
    customBaseUrl?: string
  ): Promise<ConnectionTestResult> {
    const probeModel = DEFAULT_PROBE_MODELS[provider];
    if (!probeModel) {
      return {
        provider,
        modelId: 'unknown',
        success: false,
        latencyMs: 0,
        errorMessage: `未知的厂商提供商: ${provider}`,
      };
    }

    if (!apiKey || apiKey.trim() === '') {
      return {
        provider,
        modelId: probeModel.id,
        success: false,
        latencyMs: 0,
        errorMessage: '未配置 API Key，请先输入密钥',
      };
    }

    const adapter = new CloudApiAdapter(probeModel, apiKey.trim(), customBaseUrl);
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    return new Promise<ConnectionTestResult>((resolve) => {
      let resolved = false;

      const finish = (result: Partial<ConnectionTestResult>) => {
        if (resolved) return;
        resolved = true;
        const endTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const latencyMs = Math.round(endTime - startTime);
        adapter.abort();

        resolve({
          provider,
          modelId: probeModel.id,
          success: result.success ?? false,
          latencyMs,
          errorMessage: result.errorMessage,
          isRateLimit: result.isRateLimit,
          retryAfterSeconds: result.retryAfterSeconds,
        });
      };

      // 发送最小探测请求 (ping)，不落聊天记录
      adapter.streamChat([{ role: 'user', content: 'ping' }], {
        onChunk: () => {
          // 收到首个流式分片即证明链路畅通、鉴权成功
          finish({ success: true });
        },
        onDone: () => {
          finish({ success: true });
        },
        onError: (err, isRateLimit, retryAfterSeconds) => {
          finish({
            success: false,
            errorMessage: err.message,
            isRateLimit: Boolean(isRateLimit),
            retryAfterSeconds,
          });
        },
      }).catch((err) => {
        finish({
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });

      // 10 秒硬超时保险
      setTimeout(() => {
        finish({
          success: false,
          errorMessage: '连接测试超时 (10s)，请检查网络与代理设置',
        });
      }, 10000);
    });
  }
}
