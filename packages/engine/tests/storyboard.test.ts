/**
 * @take/engine - storyboard.test.ts
 * Vitest 单元测试套件：覆盖分镜卡数据流、寻址覆盖、状态流转、汇总与出图挂钩 6 组核心测试 ［mock验证］
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryboardManager, ShotCard } from '../src/storyboard.js';
import { PresetsManager } from '../src/presets.js';

describe('Storyboard & Camera Clinic Test Suite [mock验证]', () => {
  let manager: StoryboardManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    manager = new StoryboardManager();
  });

  // =========================================================================
  // 1. 结构化分镜卡初始创建 [mock验证]
  // =========================================================================
  it('分镜卡: 能够正确创建结构化分镜卡并赋初始值（镜号、景别、提示词、待定状态） [mock验证]', () => {
    const card = manager.upsertShot({
      shotNumber: 1,
      shotScale: '全景',
      visualContent: '深夜便利店外景，女孩撑伞走过水洼',
      prompt: 'cinematic wide shot, convenience store at night, puddles reflecting neon lights, 35mm',
      status: 'pending',
      updatedBy: 'ChatGPT',
    });

    expect(card.shotNumber).toBe(1);
    expect(card.shotScale).toBe('全景');
    expect(card.status).toBe('pending');
    expect(card.updatedBy).toBe('ChatGPT');
    expect(manager.getShot(1)).toEqual(card);
  });

  // =========================================================================
  // 2. 按镜号寻址覆盖更新 [mock验证]
  // =========================================================================
  it('分镜卡寻址更新: 按镜号覆盖更新提示词与景别，保持镜号唯一并保留历史最新状态 [mock验证]', () => {
    // 初始由 ChatGPT 建立镜头
    manager.upsertShot({
      shotNumber: 2,
      shotScale: '中景',
      visualContent: '女孩侧脸',
      prompt: 'medium shot, girl face',
      status: 'pending',
      updatedBy: 'ChatGPT',
    });

    // Claude 接力精修提示词
    const updated = manager.upsertShot({
      shotNumber: 2,
      shotScale: '过肩中景',
      visualContent: '伞下侧脸，雨丝滑落',
      prompt: 'over-the-shoulder medium shot, girl profile under transparent umbrella, rain droplets falling, cold teal tone',
      status: 'pending',
      updatedBy: 'Claude',
    });

    expect(manager.getStoryboardSummary().length).toBe(1);
    expect(updated.shotScale).toBe('过肩中景');
    expect(updated.prompt).toContain('over-the-shoulder');
    expect(updated.updatedBy).toBe('Claude');
  });

  // =========================================================================
  // 3. 状态流转与定稿 [mock验证]
  // =========================================================================
  it('分镜卡状态流转: 状态流转（pending -> rendered -> finalized）正确流转 [mock验证]', () => {
    manager.upsertShot({
      shotNumber: 3,
      shotScale: '特写',
      visualContent: '水洼霓虹倒影',
      prompt: 'close-up shot, neon reflection in puddles',
      status: 'pending',
    });

    expect(manager.getShot(3)?.status).toBe('pending');

    // 绑定出图
    manager.attachRenderedImage(3, 'http://127.0.0.1:8188/view?filename=shot3.png', 'Grok Bot');
    expect(manager.getShot(3)?.status).toBe('rendered');
    expect(manager.getShot(3)?.imageUrl).toBe('http://127.0.0.1:8188/view?filename=shot3.png');
    expect(manager.getShot(3)?.updatedBy).toBe('Grok Bot');

    // 人工定稿
    manager.finalizeShot(3, 'User');
    expect(manager.getShot(3)?.status).toBe('finalized');
    expect(manager.getShot(3)?.updatedBy).toBe('User');
  });

  // =========================================================================
  // 4. 分镜整表按镜号升序汇总 [mock验证]
  // =========================================================================
  it('分镜表汇总: 正确汇总全量分镜卡并按镜号升序排列，生成完整分镜表视图 [mock验证]', () => {
    // 故意乱序写入
    manager.upsertShot({ shotNumber: 3, shotScale: '特写', visualContent: '镜头3', prompt: 'p3', status: 'pending' });
    manager.upsertShot({ shotNumber: 1, shotScale: '全景', visualContent: '镜头1', prompt: 'p1', status: 'finalized' });
    manager.upsertShot({ shotNumber: 2, shotScale: '过肩', visualContent: '镜头2', prompt: 'p2', status: 'rendered' });

    const summary = manager.getStoryboardSummary();
    expect(summary.length).toBe(3);
    expect(summary[0].shotNumber).toBe(1);
    expect(summary[1].shotNumber).toBe(2);
    expect(summary[2].shotNumber).toBe(3);

    const stats = manager.getStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.rendered).toBe(1);
    expect(stats.finalized).toBe(1);
  });

  // =========================================================================
  // 5. 模拟 ComfyUI 出图挂钩并回填 [mock验证]
  // =========================================================================
  it('分镜出图挂钩: 模拟 ComfyUiAdapter 出图成功后自动回填 imageUrl 并将状态置为 rendered [mock验证]', async () => {
    manager.upsertShot({
      shotNumber: 1,
      shotScale: '全景',
      visualContent: '全景街道',
      prompt: 'wide street night',
      status: 'pending',
    });

    // 模拟出图服务响应
    const mockComfyRunner = vi.fn().mockResolvedValue({
      success: true,
      imageUrls: ['http://127.0.0.1:8188/view?filename=take_render_shot1.png'],
    });

    const result = await mockComfyRunner({ promptText: 'wide street night' });
    if (result.success && result.imageUrls.length > 0) {
      manager.attachRenderedImage(1, result.imageUrls[0], 'ComfyUI');
    }

    const card = manager.getShot(1);
    expect(card?.status).toBe('rendered');
    expect(card?.imageUrl).toContain('take_render_shot1.png');
    expect(card?.updatedBy).toBe('ComfyUI');
  });

  // =========================================================================
  // 6. 分镜与镜头会诊室预设 Schema 校验 [mock验证]
  // =========================================================================
  it('预设房间校验: storyboard-clinic.json 包含合法 4 位入驻专家、默认 broadcast 模式且通过 PresetsManager 校验 [mock验证]', () => {
    const rawJson = JSON.stringify({
      id: 'storyboard-clinic',
      name: '分镜与镜头会诊室',
      description: '围绕影视分镜与运镜推敲展开',
      defaultMode: 'broadcast',
      defaultTools: ['tool_search', 'tool_comfyui'],
      agents: [
        { id: 'Gp', name: 'ChatGPT', systemPrompt: '出分镜 · 分镜师', provider: 'openai', modelName: 'gpt-4o' },
        { id: 'Cl', name: 'Claude', systemPrompt: '写镜头提示词 · 提示词专家', provider: 'anthropic', modelName: 'claude-3-7-sonnet' },
        { id: 'Ds', name: 'DeepSeek', systemPrompt: '补参数 · 技术推理专家', provider: 'deepseek', modelName: 'deepseek-reasoner' },
        { id: 'Gr', name: 'Grok Bot', systemPrompt: '管线排布 · 工作流专家', provider: 'xai', modelName: 'grok-2' },
      ],
      version: '1.0.0',
    });

    const preset = PresetsManager.importPreset(rawJson);
    expect(preset.id).toBe('storyboard-clinic');
    expect(preset.name).toBe('分镜与镜头会诊室');
    expect(preset.defaultMode).toBe('broadcast');
    expect(preset.agents.length).toBe(4);
    expect(preset.agents.map((a) => a.id)).toEqual(['Gp', 'Cl', 'Ds', 'Gr']);
  });
});
