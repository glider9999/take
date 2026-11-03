/**
 * @take/engine - presets.ts
 * 房间与会诊室预设包管理器：预设 Schema 校验、单个 JSON 文件导出导入往返
 */

import { AgentProfile, DispatchMode } from './types.js';

export interface RoomPreset {
  id: string;
  name: string;
  description: string;
  defaultMode: DispatchMode;
  agents: AgentProfile[];
  defaultTools: string[];
  version: string;
  createdAt?: number;
}

export class PresetsManager {
  /**
   * 导出预设为规范的单个 JSON 字符串
   */
  public static exportPreset(preset: RoomPreset): string {
    const data: RoomPreset = {
      ...preset,
      version: preset.version || '1.0.0',
      createdAt: preset.createdAt || Date.now(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 从 JSON 字符串解析并校验导入预设
   */
  public static importPreset(jsonString: string): RoomPreset {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('预设文件格式错误：非法的 JSON 文本');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('预设格式错误：根节点必须为对象');
    }

    const obj = parsed as Record<string, unknown>;

    // 必填字段校验
    if (!obj.id || typeof obj.id !== 'string') throw new Error('预设缺少必填字段: id');
    if (!obj.name || typeof obj.name !== 'string') throw new Error('预设缺少必填字段: name');
    if (!obj.defaultMode || !['single', 'mention', 'broadcast'].includes(obj.defaultMode as string)) {
      throw new Error('预设 defaultMode 必须为 single / mention / broadcast');
    }
    if (!Array.isArray(obj.agents) || obj.agents.length === 0) {
      throw new Error('预设必须包含至少一个入驻智能体 (agents)');
    }

    return {
      id: obj.id,
      name: obj.name,
      description: typeof obj.description === 'string' ? obj.description : '',
      defaultMode: obj.defaultMode as DispatchMode,
      agents: obj.agents as AgentProfile[],
      defaultTools: Array.isArray(obj.defaultTools) ? (obj.defaultTools as string[]) : [],
      version: typeof obj.version === 'string' ? obj.version : '1.0.0',
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    };
  }
}

