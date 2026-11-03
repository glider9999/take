/**
 * @take/tools - tools.test.ts
 * Vitest 单元测试套件：验证 L1/L2/L3 三级权限门的拦截与放行路径 ［mock验证］
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionGate, ToolDefinition, PermissionDeniedError } from '../src/index.js';

describe('PermissionGate Test Suite [mock验证]', () => {
  let gate: PermissionGate;
  let mockL1Tool: ToolDefinition<{ query: string }, string>;
  let mockL2Tool: ToolDefinition<{ filename: string }, string>;
  let mockL3Tool: ToolDefinition<{ command: string }, string>;

  beforeEach(() => {
    gate = new PermissionGate();

    mockL1Tool = {
      id: 'tool_search',
      name: '网络检索',
      description: '只读网络搜索',
      permissionLevel: 'L1_readonly',
      execute: vi.fn().mockResolvedValue('搜索结果：AI影像热度'),
    };

    mockL2Tool = {
      id: 'tool_save_workflow',
      name: '保存工作流文件',
      description: '局部文件写入',
      permissionLevel: 'L2_preauthorized',
      execute: vi.fn().mockResolvedValue('工作流已保存'),
    };

    mockL3Tool = {
      id: 'tool_exec_shell',
      name: '执行Shell命令',
      description: '破坏性系统调用',
      permissionLevel: 'L3_destructive',
      execute: vi.fn().mockResolvedValue('命令执行完毕'),
    };

    gate.registerTool(mockL1Tool);
    gate.registerTool(mockL2Tool);
    gate.registerTool(mockL3Tool);
  });

  it('L1 只读工具：零阻断直接执行 [mock验证]', async () => {
    const res = await gate.execute('tool_search', { query: 'test' });
    expect(res).toBe('搜索结果：AI影像热度');
    expect(mockL1Tool.execute).toHaveBeenCalledWith({ query: 'test' });
  });

  it('L2 写入工具：获得预授权后自动放行，未获预授权时触发确认 [mock验证]', async () => {
    // 1. 未预授权且无确认处理器：抛出拒绝
    await expect(gate.execute('tool_save_workflow', { filename: 'a.json' })).rejects.toThrow(
      PermissionDeniedError
    );

    // 2. 在设置中预授权后：自动放行
    gate.grantPreAuthorization('tool_save_workflow');
    const res = await gate.execute('tool_save_workflow', { filename: 'a.json' });
    expect(res).toBe('工作流已保存');

    // 3. 撤销预授权后：再次拦截
    gate.revokePreAuthorization('tool_save_workflow');
    await expect(gate.execute('tool_save_workflow', { filename: 'a.json' })).rejects.toThrow(
      PermissionDeniedError
    );
  });

  it('L3 破坏性工具：强制每次弹窗确认，用户同意放行，用户拒绝严格抛错 [mock验证]', async () => {
    const mockConfirm = vi.fn();
    gate.setConfirmationHandler(mockConfirm);

    // a) 用户确认同意：放行
    mockConfirm.mockResolvedValueOnce(true);
    const res = await gate.execute('tool_exec_shell', { command: 'rm -rf tmp/' });
    expect(res).toBe('命令执行完毕');
    expect(mockConfirm).toHaveBeenCalledTimes(1);

    // b) 用户确认拒绝：严格抛出 PermissionDeniedError
    mockConfirm.mockResolvedValueOnce(false);
    await expect(gate.execute('tool_exec_shell', { command: 'rm -rf tmp/' })).rejects.toThrow(
      '用户拒绝执行高危 L3 破坏性操作'
    );
  });
});

