/**
 * @take/engine - presets.test.ts
 * Vitest 单元测试套件：验证房间预设包导出、导入与往返一致性 ［mock验证］
 */

import { describe, it, expect } from 'vitest';
import { PresetsManager, RoomPreset } from '../src/presets.js';

describe('PresetsManager Test Suite [mock验证]', () => {
  const samplePreset: RoomPreset = {
    id: 'test-room',
    name: '测试测试会诊室',
    description: '用于单元测试的预设包',
    defaultMode: 'broadcast',
    version: '1.0.0',
    defaultTools: ['tool_search'],
    agents: [
      {
        id: 'agent_a',
        name: 'Agent A',
        systemPrompt: '测试人设 A',
        provider: 'anthropic',
        modelName: 'claude-3-7-sonnet',
      },
      {
        id: 'agent_b',
        name: 'Agent B',
        systemPrompt: '测试人设 B',
        provider: 'openai',
        modelName: 'gpt-4o',
      },
    ],
  };

  it('导出与导入往返一致性：导出的 JSON 重新导入后属性完全一致 [mock验证]', () => {
    const exportedJson = PresetsManager.exportPreset(samplePreset);
    expect(typeof exportedJson).toBe('string');
    expect(exportedJson).toContain('"id": "test-room"');

    const imported = PresetsManager.importPreset(exportedJson);
    expect(imported.id).toBe(samplePreset.id);
    expect(imported.name).toBe(samplePreset.name);
    expect(imported.defaultMode).toBe(samplePreset.defaultMode);
    expect(imported.agents).toHaveLength(2);
    expect(imported.agents[0].id).toBe('agent_a');
  });

  it('校验非法输入：缺少必填字段或格式损坏应抛出明确错误 [mock验证]', () => {
    // 1. 损坏的 JSON
    expect(() => PresetsManager.importPreset('{ id: invalid json }')).toThrow(
      '预设文件格式错误'
    );

    // 2. 缺少 id
    expect(() => PresetsManager.importPreset('{"name": "缺少ID"}')).toThrow(
      '预设缺少必填字段: id'
    );

    // 3. 非法的 defaultMode
    expect(() =>
      PresetsManager.importPreset('{"id": "a", "name": "b", "defaultMode": "invalid", "agents": []}')
    ).toThrow('预设 defaultMode 必须为 single / mention / broadcast');

    // 4. 空的 agents 列表
    expect(() =>
      PresetsManager.importPreset('{"id": "a", "name": "b", "defaultMode": "single", "agents": []}')
    ).toThrow('预设必须包含至少一个入驻智能体');
  });
});

