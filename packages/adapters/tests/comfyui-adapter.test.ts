/**
 * @take/adapters - comfyui-adapter.test.ts
 * Vitest 单元测试套件：覆盖 ComfyUI 适配器 7 组核心测试 ［mock验证］
 * 涵盖：queuePrompt 成功提交、pollHistory 轮询取图、结构化报错提取、超时控制、健康检查判活/判死、地址配置持久化、连接测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setFetchClient,
  ComfyUiAdapter,
  DEFAULT_COMFYUI_URL,
} from '../src/index.js';

describe('ComfyUI Adapter Test Suite [mock验证]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. 提交成功回传 prompt_id [mock验证]
  // =========================================================================
  it('ComfyUI: 成功提交工作流并返回 prompt_id [mock验证]', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    setFetchClient(vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({ prompt_id: 'pid-comfy-1001', number: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const promptId = await adapter.queuePrompt({ '3': { class_type: 'KSampler' } });

    expect(capturedUrl).toBe('http://127.0.0.1:8188/prompt');
    expect(capturedBody).toContain('KSampler');
    expect(promptId).toBe('pid-comfy-1001');
  });

  // =========================================================================
  // 2. 轮询成功取图 [mock验证]
  // =========================================================================
  it('ComfyUI: 轮询成功并正确组装生成图像的完整访问 URL [mock验证]', async () => {
    setFetchClient(vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      'pid-comfy-1001': {
        outputs: {
          '9': {
            images: [
              { filename: 'take_rainynight_01.png', subfolder: 'renders', type: 'output' },
              { filename: 'take_rainynight_02.png', subfolder: '', type: 'output' },
            ],
          },
        },
      },
    }), { status: 200 })));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const result = await adapter.pollHistory('pid-comfy-1001', 5);

    expect(result.success).toBe(true);
    expect(result.imageUrls.length).toBe(2);
    expect(result.imageUrls[0]).toBe('http://127.0.0.1:8188/view?filename=take_rainynight_01.png&subfolder=renders&type=output');
    expect(result.imageUrls[1]).toBe('http://127.0.0.1:8188/view?filename=take_rainynight_02.png&subfolder=&type=output');
  });

  // =========================================================================
  // 3. 节点报错结构化提取 [mock验证]
  // =========================================================================
  it('ComfyUI: 节点执行报错时精准提取结构化错误详情（节点ID、异常类型、入参摘要） [mock验证]', async () => {
    setFetchClient(vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      'pid-comfy-err': {
        status: {
          status_str: 'error',
          completed: false,
          messages: [
            [
              'execution_error',
              {
                node_id: '4',
                node_type: 'KSampler',
                exception_type: 'RuntimeError',
                exception_message: 'CUDA out of memory. Tried to allocate 2.40 GiB',
                current_inputs: { seed: 42, steps: 30, cfg: 7.5 },
              },
            ],
          ],
        },
      },
    }), { status: 200 })));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const result = await adapter.pollHistory('pid-comfy-err', 5);

    expect(result.success).toBe(false);
    expect(result.errorNodeId).toBe('4');
    expect(result.structuredError).toBeDefined();
    expect(result.structuredError?.nodeId).toBe('4');
    expect(result.structuredError?.nodeType).toBe('KSampler');
    expect(result.structuredError?.exceptionType).toBe('RuntimeError');
    expect(result.structuredError?.exceptionMessage).toContain('CUDA out of memory');
    expect(result.structuredError?.inputSummary).toContain('"seed": 42');
    expect(result.rawError).toContain('ComfyUI 节点 [4] 执行失败: RuntimeError');
  });

  // =========================================================================
  // 4. 超时安全返回（每次轮询必须返回全新 Response 实例） [mock验证]
  // =========================================================================
  it('ComfyUI: 任务执行超时在指定等待时间后安全返回超时错误 [mock验证]', async () => {
    // 采用 mockImplementation 保证每次轮询返回独立 Response 实例，防止 body 被二次读取抛错
    setFetchClient(vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 })));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const result = await adapter.pollHistory('pid-timeout', 0.2);

    expect(result.success).toBe(false);
    expect(result.rawError).toContain('ComfyUI 任务执行超时');
  });

  // =========================================================================
  // 5. 健康检查判活/判死 [mock验证]
  // =========================================================================
  it('ComfyUI 健康检查: checkHealth 能够判活并提取版本与系统信息，宕机时判死 [mock验证]', async () => {
    // 判活：200 成功响应
    setFetchClient(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      system: { comfyui_version: '0.3.10', os: 'Linux', python_version: '3.11.8' },
      devices: [{ name: 'NVIDIA RTX 4090', type: 'cuda', vramTotal: 24576, vramFree: 18432 }],
    }), { status: 200 })));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const healthAlive = await adapter.checkHealth();
    expect(healthAlive.alive).toBe(true);
    expect(healthAlive.version).toBe('0.3.10');
    expect(healthAlive.devices?.[0].name).toBe('NVIDIA RTX 4090');

    // 判死：500 异常响应，保留底层错误
    setFetchClient(vi.fn().mockResolvedValueOnce(new Response('Server Error', { status: 500 })));
    const healthDead = await adapter.checkHealth();
    expect(healthDead.alive).toBe(false);
    expect(healthDead.error).toContain('HTTP 500');
  });

  // =========================================================================
  // 6. 地址配置读写与规范化 [mock验证]
  // =========================================================================
  it('ComfyUI 地址配置: 支持读取与保存端点，自动清洗末尾斜杠 [mock验证]', () => {
    const mockStorage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
    };
    vi.stubGlobal('localStorage', mockLocalStorage);

    // 默认回退
    expect(ComfyUiAdapter.getSavedEndpoint()).toBe(DEFAULT_COMFYUI_URL);

    // 保存并清洗斜杠
    ComfyUiAdapter.saveEndpoint('http://192.168.1.100:8188///');
    expect(ComfyUiAdapter.getSavedEndpoint()).toBe('http://192.168.1.100:8188');

    // 实例读取
    const adapter = new ComfyUiAdapter();
    expect(adapter.getBaseUrl()).toBe('http://192.168.1.100:8188');

    // 实例修改
    adapter.setBaseUrl('http://10.0.0.5:8188/');
    expect(adapter.getBaseUrl()).toBe('http://10.0.0.5:8188');
  });

  // =========================================================================
  // 7. 连接测试统一入口与原始错误透传 [mock验证]
  // =========================================================================
  it('ComfyUI 连接测试: testConnection 统一返回耗时、版本与错误全文 [mock验证]', async () => {
    // 成功连接测试
    setFetchClient(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      system: { comfyui_version: '0.3.10' },
    }), { status: 200 })));

    const adapter = new ComfyUiAdapter('http://127.0.0.1:8188');
    const successResult = await adapter.testConnection();
    expect(successResult.success).toBe(true);
    expect(successResult.version).toBe('0.3.10');
    expect(successResult.latencyMs).toBeGreaterThanOrEqual(0);

    // 失败连接测试：底层网络异常 ECONNREFUSED 必须并入 errorMessage
    setFetchClient(vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED: 连接被拒绝')));
    const failResult = await adapter.testConnection();
    expect(failResult.success).toBe(false);
    expect(failResult.errorMessage).toContain('ECONNREFUSED');
  });
});
