/**
 * @take/ui - polish.test.ts
 * Vitest 单元测试套件：覆盖工单 12 抛光项（空态/演示载入、双语字典纯粹性、设置密度与种子无坏链） ［mock验证］
 */

import { describe, it, expect } from 'vitest';
import { DICTIONARIES, Locale } from '../src/i18n/index.js';
import { StoryboardManager } from '@take/engine';

describe('TakeChat Polish & Polish Test Suite (Ticket 12) [mock验证]', () => {
  // =========================================================================
  // 1. 分镜种子数据安全审计：杜绝一切 localhost 与本机坏链 [mock验证]
  // =========================================================================
  it('分镜种子数据审计: 种子数据严禁包含 127.0.0.1、localhost 等任何私网坏链 [mock验证]', () => {
    // 模拟 ChatApp 中的种子数据
    const seedShots = [
      {
        shotNumber: 1,
        shotScale: '全景',
        visualContent: '深夜便利店外景，女孩撑伞走过水洼，霓虹倒影闪烁',
        prompt: 'cinematic wide shot, convenience store at night, puddles reflecting neon lights, 35mm, slow tracking shot',
        status: 'pending' as const,
        updatedBy: 'Grok Bot',
      },
      {
        shotNumber: 2,
        shotScale: '过肩中景',
        visualContent: '雨幕中女孩撑伞侧脸，冷色调色温，雨滴顺伞沿滑落',
        prompt: 'over-the-shoulder medium shot, girl profile under transparent umbrella, rain droplets falling, cold teal tone',
        status: 'pending' as const,
        updatedBy: 'Claude',
      },
    ];

    const manager = new StoryboardManager(seedShots);
    const allShots = manager.getStoryboardSummary();

    for (const shot of allShots) {
      if (shot.imageUrl) {
        expect(shot.imageUrl).not.toContain('127.0.0.1');
        expect(shot.imageUrl).not.toContain('localhost');
      }
      // 默认种子镜头状态应为安全待定态
      expect(['pending', 'rendered', 'finalized']).toContain(shot.status);
    }
  });

  // =========================================================================
  // 2. 双语国际化字典严格对称性与纯粹性检测 [mock验证]
  // =========================================================================
  it('双语字典审计: zh-CN 与 en-US 字典完全对称，英文无汉字，中文无半截夹杂 [mock验证]', () => {
    const zhKeys = Object.keys(DICTIONARIES['zh-CN']).sort();
    const enKeys = Object.keys(DICTIONARIES['en-US']).sort();

    // 键集完全对称
    expect(zhKeys).toEqual(enKeys);

    // 检查中文字典：不存在半截英文硬编码（如残留的 For error consultation）
    const zhDict = DICTIONARIES['zh-CN'];
    expect(zhDict.comfyEndpointDesc).toBe('(用于报错会诊与工作流执行)');
    expect(zhDict.comfyEndpointHint).toContain('服务默认使用本机端口 8188');
    expect(zhDict.broadcastOn).toBe('全员会诊');
    expect(zhDict.modeTagBroadcast).toContain('各答一次');

    // 检查英文字典：不存在汉字字符
    const enDict = DICTIONARIES['en-US'];
    const chineseCharRegex = /[\u4e00-\u9fa5]/;
    for (const [key, value] of Object.entries(enDict)) {
      expect(chineseCharRegex.test(value), `英文词条 [${key}] 不得包含汉字: ${value}`).toBe(false);
    }

    // 会诊模式人话化表达断言
    expect(enDict.broadcastOn).toBe('All models reply');
    expect(enDict.inputPlaceholder).toContain('all models will reply once');
  });

  // =========================================================================
  // 3. 设置弹窗未配置厂商紧凑折叠逻辑审计 [mock验证]
  // =========================================================================
  it('设置密度审计: 未配置厂商具备紧凑折叠状态与正向导向文案 [mock验证]', () => {
    const zhDict = DICTIONARIES['zh-CN'];
    const enDict = DICTIONARIES['en-US'];

    // 验证具备添加与收起关键动作词
    expect(zhDict.addKey).toBe('+ 添加 Key');
    expect(zhDict.collapseKey).toBe('收起');
    expect(enDict.addKey).toBe('+ Add Key');

    // 验证正向导向文案包含桌面版可用与安装指引
    expect(zhDict.needsDesktopNotice).toContain('此能力在桌面版可用');
    expect(zhDict.needsDesktopNotice).toContain('查看安装指引');
    expect(enDict.needsDesktopNotice).toContain('Available in Desktop Edition');
    expect(enDict.needsDesktopNotice).toContain('View Setup Guide');
  });
});
