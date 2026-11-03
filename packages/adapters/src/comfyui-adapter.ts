/**
 * @take/adapters - comfyui-adapter.ts
 * 本机 ComfyUI HTTP API 适配器（默认直连 127.0.0.1:8188）
 * 支持提交工作流、轮询队列状态、取回生成图像与报错原文完整回传
 */

import { universalFetch } from './http-client.js';

export interface ComfyExecutionResult {
  promptId: string;
  success: boolean;
  imageUrls: string[];
  rawError?: string;
  errorNodeId?: string;
}

export class ComfyUiAdapter {
  constructor(private baseUrl: string = 'http://127.0.0.1:8188') {
    this.baseUrl = this.baseUrl.replace(/\/+$/, '');
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
   * 轮询执行历史与状态，取回图片或报错信息
   */
  public async pollHistory(
    promptId: string,
    maxWaitSeconds: number = 120
  ): Promise<ComfyExecutionResult> {
    const startTime = Date.now();
    const historyUrl = `${this.baseUrl}/history/${promptId}`;

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      await new Promise((r) => setTimeout(r, 1000));

      const res = await universalFetch(historyUrl);
      if (!res.ok) continue;

      const data = await res.json();
      const promptHistory = data[promptId];
      if (!promptHistory) continue;

      // 1. 检查节点执行错误
      const status = promptHistory.status;
      if (status && status.status_str === 'error') {
        const nodeErrors = status.messages ? JSON.stringify(status.messages) : '未知节点错误';
        return {
          promptId,
          success: false,
          imageUrls: [],
          rawError: `ComfyUI 节点执行失败: ${nodeErrors}`,
        };
      }

      // 2. 检查输出成果
      const outputs = promptHistory.outputs;
      if (outputs) {
        const imageUrls: string[] = [];
        for (const [nodeId, nodeOutput] of Object.entries<any>(outputs)) {
          if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
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

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}

