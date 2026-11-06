/**
 * @take/adapters - connection-tester.ts (工单 18 扩容版)
 * 11 家厂商 API 联调自检器
 * 涵盖：
 * 既有 6 家：Anthropic, OpenAI, Google, DeepSeek, Moonshot/Kimi, OpenRouter
 * 新增 5 家：xAI(Grok), 阿里千问(Qwen), 智谱(GLM), 豆包(Doubao), MiniMax
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

// 11 家厂商联调自检默认最小模型探针定义
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
  // --- 工单 18 新增 5 家 ---
  xai: {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xai',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.x.ai/v1',
    contextWindow: 131072,
    supportsStreaming: true,
  },
  qwen: {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'qwen',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    contextWindow: 131072,
    supportsStreaming: true,
  },
  zhipu: {
    id: 'glm-4-flash',
    name: 'GLM-4 Flash',
    provider: 'zhipu',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    contextWindow: 128000,
    supportsStreaming: true,
  },
  doubao: {
    id: 'doubao-lite-128k',
    name: 'Doubao Lite 128k',
    provider: 'doubao',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    contextWindow: 128000,
    supportsStreaming: true,
  },
  minimax: {
    id: 'MiniMax-Text-01',
    name: 'MiniMax Text 01',
    provider: 'minimax',
    driverType: 'cloud_api',
    defaultBaseUrl: 'https://api.minimax.io/v1',
    contextWindow: 1000000,
    supportsStreaming: true,
  },
};

export class ConnectionTester {
  public static async testConnection(
    provider: string,
    apiKey: string,
    customBaseUrl?: string,
    customModelId?: string
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
        modelId: customModelId || probeModel.id,
        success: false,
        latencyMs: 0,
        errorMessage: '未配置 API Key，请先输入密钥',
      };
    }

    const actualModelEntry: ModelRegistryEntry = customModelId
      ? { ...probeModel, id: customModelId.trim() }
      : probeModel;

    const adapter = new CloudApiAdapter(actualModelEntry, apiKey.trim(), customBaseUrl);
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return new Promise<ConnectionTestResult>((resolve) => {
      let resolved = false;

      const finish = (result: Partial<ConnectionTestResult>) => {
        if (resolved) return;
        resolved = true;
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const latencyMs = Math.round(endTime - startTime);
        adapter.abort();

        resolve({
          provider,
          modelId: actualModelEntry.id,
          success: result.success ?? false,
          latencyMs,
          errorMessage: result.errorMessage,
          isRateLimit: result.isRateLimit,
          retryAfterSeconds: result.retryAfterSeconds,
        });
      };

      adapter
        .streamChat([{ role: 'user', content: 'ping' }], {
          onChunk: () => {
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
        })
        .catch((err) => {
          finish({
            success: false,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        });

      // 10 秒硬超时保护
      setTimeout(() => {
        finish({
          success: false,
          errorMessage: '连接测试超时 (10s)，请检查网络与代理设置',
        });
      }, 10000);
    });
  }
}
