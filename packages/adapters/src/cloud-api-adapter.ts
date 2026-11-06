/**
 * @take/adapters - cloud-api-adapter.ts (工单 19 扩容版)
 * 12 家厂商云端大模型通用适配器
 * 涵盖：
 * - Anthropic (原生 Messages API)
 * - Google Gemini (Gemini REST/兼容接口)
 * - OpenAI 兼容标准接口：OpenAI, DeepSeek, Moonshot/Kimi, OpenRouter, xAI/Grok, Qwen/阿里千问, GLM/智谱, Doubao/豆包火山方舟, MiniMax, NVIDIA
 */

import { universalFetch } from './http-client.js';

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'moonshot'
  | 'openrouter'
  | 'xai'
  | 'qwen'
  | 'zhipu'
  | 'doubao'
  | 'minimax'
  | 'nvidia';

export interface ModelRegistryEntry {
  id: string;
  name: string;
  provider: ProviderId;
  driverType: 'cloud_api' | 'local_acp' | 'local_pty';
  defaultBaseUrl?: string;
  contextWindow: number;
  supportsStreaming: boolean;
  requiredHeaders?: Record<string, string>;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
}

export interface StreamCallbacks {
  onChunk: (delta: string) => void;
  onDone: (finalText: string, usage: { input: number; output: number }) => void;
  onError: (error: Error, isRateLimit?: boolean, retryAfterSeconds?: number) => void;
}

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number, message: string = '触发 429 速率限制') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ApiStatusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiStatusError';
  }
}

export class CloudApiAdapter {
  private abortController: AbortController | null = null;

  constructor(
    public readonly modelEntry: ModelRegistryEntry,
    private apiKey: string,
    private customBaseUrl?: string
  ) {}

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async streamChat(
    messages: Array<{ role: string; content: string }>,
    callbacks: StreamCallbacks
  ): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const baseUrl = (this.customBaseUrl || this.modelEntry.defaultBaseUrl || '').replace(/\/+$/, '');
    if (!baseUrl) {
      callbacks.onError(new Error(`未配置厂商 ${this.modelEntry.provider} 的 baseUrl`), false);
      return;
    }

    try {
      if (this.modelEntry.provider === 'anthropic') {
        await this.streamAnthropic(baseUrl, messages, signal, callbacks);
      } else if (this.modelEntry.provider === 'google') {
        await this.streamGoogleGemini(baseUrl, messages, signal, callbacks);
      } else {
        // OpenAI, DeepSeek, Moonshot, OpenRouter, xAI, Qwen, Zhipu, Doubao, MiniMax, NVIDIA 统一走 OpenAI 兼容规范
        await this.streamOpenAiCompatible(baseUrl, messages, signal, callbacks);
      }
    } catch (err: unknown) {
      if (signal.aborted) {
        callbacks.onError(new Error('请求已被用户主动终止'), false);
      } else if (err instanceof RateLimitError) {
        callbacks.onError(err, true, err.retryAfterSeconds);
      } else {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)), false);
      }
    } finally {
      this.abortController = null;
    }
  }

  private async streamAnthropic(
    baseUrl: string,
    messages: Array<{ role: string; content: string }>,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const url = `${baseUrl}/messages`;
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...(this.modelEntry.requiredHeaders || {}),
    };

    const response = await universalFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.modelEntry.id,
        messages: conversation,
        system: systemMsg,
        max_tokens: 2048,
        stream: true,
      }),
      signal,
    });

    await this.handleResponseStatus(response);
    await this.parseAnthropicSse(response, callbacks);
  }

  private async streamOpenAiCompatible(
    baseUrl: string,
    messages: Array<{ role: string; content: string }>,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const url = `${baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(this.modelEntry.requiredHeaders || {}),
    };

    const response = await universalFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.modelEntry.id,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });

    await this.handleResponseStatus(response);
    await this.parseOpenAiSse(response, callbacks);
  }

  private async streamGoogleGemini(
    baseUrl: string,
    messages: Array<{ role: string; content: string }>,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const url = `${baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await universalFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.modelEntry.id,
        messages,
        stream: true,
      }),
      signal,
    });

    await this.handleResponseStatus(response);
    await this.parseOpenAiSse(response, callbacks);
  }

  private async handleResponseStatus(response: Response): Promise<void> {
    if (response.ok) return;

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
      throw new RateLimitError(retryAfter, `触发 ${this.modelEntry.provider} 429 速率限制`);
    }

    const errText = await response.text();
    throw new ApiStatusError(response.status, `API 异常 [HTTP ${response.status}]: ${errText.slice(0, 150)}`);
  }

  private async parseOpenAiSse(response: Response, callbacks: StreamCallbacks): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流数据');

    const decoder = new TextDecoder();
    let accumulated = '';
    let usage = { input: 0, output: 0 };
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.processOpenAiSseLine(line, (delta) => {
          accumulated += delta;
          callbacks.onChunk(delta);
        }, (u) => {
          usage = u;
        });
      }
    }

    if (buffer.trim()) {
      this.processOpenAiSseLine(buffer, (delta) => {
        accumulated += delta;
        callbacks.onChunk(delta);
      }, (u) => {
        usage = u;
      });
    }

    if (usage.input === 0 && usage.output === 0) {
      usage = { input: Math.ceil(accumulated.length * 0.4), output: Math.ceil(accumulated.length * 0.6) };
    }
    callbacks.onDone(accumulated, usage);
  }

  private processOpenAiSseLine(
    line: string,
    onChunk: (delta: string) => void,
    onUsage: (usage: { input: number; output: number }) => void
  ): void {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return;
    const dataPayload = trimmed.slice(5).trim();
    if (dataPayload === '[DONE]') return;

    try {
      const json = JSON.parse(dataPayload);
      const delta = json.choices?.[0]?.delta?.content || '';
      if (delta) {
        onChunk(delta);
      }
      if (json.usage) {
        onUsage({
          input: json.usage.prompt_tokens || 0,
          output: json.usage.completion_tokens || 0,
        });
      }
    } catch {
      // 容错
    }
  }

  private async parseAnthropicSse(response: Response, callbacks: StreamCallbacks): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流数据');

    const decoder = new TextDecoder();
    let accumulated = '';
    let usage = { input: 0, output: 0 };
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.processAnthropicSseLine(line, (delta) => {
          accumulated += delta;
          callbacks.onChunk(delta);
        }, (partialUsage) => {
          usage = { ...usage, ...partialUsage };
        });
      }
    }

    if (buffer.trim()) {
      this.processAnthropicSseLine(buffer, (delta) => {
        accumulated += delta;
        callbacks.onChunk(delta);
      }, (partialUsage) => {
        usage = { ...usage, ...partialUsage };
      });
    }

    callbacks.onDone(accumulated, usage);
  }

  private processAnthropicSseLine(
    line: string,
    onChunk: (delta: string) => void,
    onUsage: (usage: { input?: number; output?: number }) => void
  ): void {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return;
    const dataPayload = trimmed.slice(5).trim();

    try {
      const json = JSON.parse(dataPayload);
      if (json.type === 'content_block_delta') {
        const delta = json.delta?.text || '';
        if (delta) {
          onChunk(delta);
        }
      } else if (json.type === 'message_start' && json.message?.usage) {
        onUsage({ input: json.message.usage.input_tokens || 0 });
      } else if (json.type === 'message_delta' && json.usage) {
        onUsage({ output: json.usage.output_tokens || 0 });
      }
    } catch {
      // 容错
    }
  }
}
