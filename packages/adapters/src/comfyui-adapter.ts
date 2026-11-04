/**
 * @take/adapters - comfyui-adapter.ts
 * 本机 ComfyUI HTTP API 适配器（默认直连 127.0.0.1:8188）
 * 核心特性：
 * 1. 提交工作流 queuePrompt（返回 prompt_id）；
 * 2. 轮询历史 pollHistory：成功取回生成图像完整 URL；
 * 3. 结构化错误提取：失败节点 ID、节点类型、异常类型、异常消息原文、入参摘要；
 * 4. 健康检查 checkHealth：GET /system_stats 判活并返回版本及环境信息，保留底层错误不吞没；
 * 5. 连接测试 testConnection：供设置面板调用，统一交互形态，失败透传底层错误原文；
 * 6. 本地配置持久化：支持读取与保存 ComfyUI 服务端点。
 */

import { universalFetch } from './http-client.js';

export const DEFAULT_COMFYUI_URL = 'http://127.0.0.1:8188';
export const COMFYUI_STORAGE_KEY = 'take_comfyui_endpoint';

export interface ComfyNodeErrorDetails {
  nodeId: string;
  nodeType?: string;
  exceptionType: string;
  exceptionMessage: string;
  inputSummary?: string;
}

export interface ComfyExecutionResult {
  promptId: string;
  success: boolean;
  imageUrls: string[];
  rawError?: string;
  errorNodeId?: string;
  structuredError?: ComfyNodeErrorDetails;
}

export interface ComfySystemStats {
  alive: boolean;
  version?: string;
  os?: string;
  pythonVersion?: string;
  devices?: Array<{ name: string; type: string; vramTotal?: number; vramFree?: number }>;
  rawStats?: Record<string, unknown>;
  error?: string;
}

export interface ComfyConnectionTestResult {
  success: boolean;
  latencyMs: number;
  version?: string;
  errorMessage?: string;
}

export class ComfyUiAdapter {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || ComfyUiAdapter.getSavedEndpoint() || DEFAULT_COMFYUI_URL).replace(/\/+$/, '');
  }

  /**
   * 从本地持久化配置读取 ComfyUI 端点
   */
  public static getSavedEndpoint(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(COMFYUI_STORAGE_KEY) || DEFAULT_COMFYUI_URL;
    }
    return DEFAULT_COMFYUI_URL;
  }

  /**
   * 保存 ComfyUI 端点至本地持久化配置
   */
  public static saveEndpoint(endpoint: string): void {
    const clean = (endpoint.trim() || DEFAULT_COMFYUI_URL).replace(/\/+$/, '');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(COMFYUI_STORAGE_KEY, clean);
    }
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = (url.trim() || DEFAULT_COMFYUI_URL).replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 提交工作流到 ComfyUI 执行队列
   */
  public async queuePrompt(
    workflowJson: Record<string, unknown>,
    clientId: string = 'take_client'
  ): Promise<string> {
    const url = `${this.baseUrl}/prompt`;
    const res = await universalFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: workflowJson, client_id: clientId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ComfyUI 提交失败 [HTTP ${res.status}]: ${errText}`);
    }

    const data = await res.json();
    if (!data.prompt_id) {
      throw new Error('ComfyUI 未返回合法的 prompt_id');
    }
    return data.prompt_id;
  }

  /**
   * 轮询执行历史与状态，取回图片或结构化报错信息
   */
  public async pollHistory(
    promptId: string,
    maxWaitSeconds: number = 120
  ): Promise<ComfyExecutionResult> {
    const startTime = Date.now();
    const historyUrl = `${this.baseUrl}/history/${promptId}`;

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      await new Promise((r) => setTimeout(r, 100));

      let res: Response;
      try {
        res = await universalFetch(historyUrl);
      } catch {
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const promptHistory = data[promptId];
      if (!promptHistory) continue;

      // 1. 检查节点执行错误并结构化提取
      const status = promptHistory.status;
      if (status && (status.status_str === 'error' || status.completed === false)) {
        const structured = this.parseErrorMessages(status.messages);
        return {
          promptId,
          success: false,
          imageUrls: [],
          errorNodeId: structured.nodeId,
          rawError: `ComfyUI 节点 [${structured.nodeId}] 执行失败: ${structured.exceptionType} - ${structured.exceptionMessage}`,
          structuredError: structured,
        };
      }

      // 2. 检查输出成果
      const outputs = promptHistory.outputs;
      if (outputs) {
        const imageUrls: string[] = [];
        for (const [nodeId, nodeOutput] of Object.entries<any>(outputs)) {
          if (nodeOutput && nodeOutput.images && Array.isArray(nodeOutput.images)) {
            for (const img of nodeOutput.images) {
              imageUrls.push(
                `${this.baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(
                  img.subfolder || ''
                )}&type=${encodeURIComponent(img.type || 'output')}`
              );
            }
          }
        }

        return {
          promptId,
          success: true,
          imageUrls,
        };
      }
    }

    return {
      promptId,
      success: false,
      imageUrls: [],
      rawError: `ComfyUI 任务执行超时 (${maxWaitSeconds}s)`,
    };
  }

  /**
   * 健康检查：GET /system_stats 判活并返回版本及系统信息
   * 严格保留底层错误（error 字段），不吞没网络异常
   */
  public async checkHealth(): Promise<ComfySystemStats> {
    const url = `${this.baseUrl}/system_stats`;
    try {
      const res = await universalFetch(url);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          alive: false,
          error: `HTTP ${res.status}${errText ? `: ${errText}` : ''}`,
        };
      }
      const data = await res.json();
      return {
        alive: true,
        version: data.system?.comfyui_version || data.comfyui_version || 'unknown',
        os: data.system?.os || data.os,
        pythonVersion: data.system?.python_version || data.python_version,
        devices: data.devices || [],
        rawStats: data,
      };
    } catch (err) {
      return {
        alive: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 连接测试入口（供设置面板调用，统一交互形态）
   * 失败时把底层原始错误全文精准并入 errorMessage
   */
  public async testConnection(): Promise<ComfyConnectionTestResult> {
    const startTime = Date.now();
    try {
      const health = await this.checkHealth();
      const latencyMs = Date.now() - startTime;
      if (health.alive) {
        return {
          success: true,
          latencyMs,
          version: health.version,
        };
      } else {
        return {
          success: false,
          latencyMs,
          errorMessage: health.error
            ? `ComfyUI 服务连接失败: ${health.error} (端点: ${this.baseUrl})`
            : `ComfyUI 服务未响应或返回非 200 (端点: ${this.baseUrl})`,
        };
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 解析 ComfyUI 状态中的 messages 提取结构化错误详情
   */
  private parseErrorMessages(messages: unknown): ComfyNodeErrorDetails {
    if (!messages) {
      return {
        nodeId: 'unknown',
        exceptionType: 'ExecutionError',
        exceptionMessage: '未知节点执行异常',
      };
    }

    let errPayload: Record<string, any> | null = null;

    if (Array.isArray(messages)) {
      for (const item of messages) {
        if (Array.isArray(item) && item[0] === 'execution_error' && typeof item[1] === 'object') {
          errPayload = item[1];
          break;
        } else if (item && typeof item === 'object') {
          if (item.node_id || item.exception_message) {
            errPayload = item;
            break;
          }
        }
      }
      if (!errPayload && messages.length > 0) {
        if (typeof messages[0] === 'string') {
          const raw = messages.join(' ');
          const colonIdx = raw.indexOf(':');
          const nodeName = colonIdx > -1 ? raw.slice(0, colonIdx).trim() : 'unknown';
          return {
            nodeId: nodeName,
            nodeType: nodeName,
            exceptionType: 'ExecutionError',
            exceptionMessage: raw,
          };
        }
      }
    } else if (typeof messages === 'object') {
      errPayload = messages as Record<string, any>;
    }

    if (errPayload) {
      const nodeId = String(errPayload.node_id || errPayload.nodeId || 'unknown');
      const nodeType = errPayload.node_type || errPayload.nodeType || undefined;
      const exceptionType = errPayload.exception_type || errPayload.exceptionType || 'RuntimeError';
      const exceptionMessage = errPayload.exception_message || errPayload.exceptionMessage || errPayload.message || '执行失败';
      let inputSummary: string | undefined;
      if (errPayload.current_inputs || errPayload.inputs) {
        inputSummary = JSON.stringify(errPayload.current_inputs || errPayload.inputs, null, 2);
      }

      return {
        nodeId,
        nodeType,
        exceptionType,
        exceptionMessage,
        inputSummary,
      };
    }

    return {
      nodeId: 'unknown',
      exceptionType: 'ExecutionError',
      exceptionMessage: JSON.stringify(messages),
    };
  }
}
