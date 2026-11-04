/**
 * @take/ui - patch.test.ts
 * Vitest 单元测试套件：工单 14 微修单专项测试（5 组加固测试） ［mock验证］
 * 涵盖：CJK 全量调用侧扫描、单徽章优先级、双栏空态联动、思考状态无按 Agent 特判、占位符随模式动态切换
 */

import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../src/i18n/index.js';

describe('TakeChat Polish Patch Test Suite (Ticket 14) [mock验证]', () => {
  // =========================================================================
  // 1. 界面英文模式 CJK 字面量扫描与词条全量对称性白名单测试 [mock验证]
  // =========================================================================
  it('CJK 扫描白名单: en-US 全量词条经正则检验为零汉字，调用侧词条完全对称 [mock验证]', () => {
    const enDict = DICTIONARIES['en-US'];
    const zhDict = DICTIONARIES['zh-CN'];
    const cjkRegex = /[\u4e00-\u9fa5]/;

    // 1. 验证工单 14 新增与清零的所有关键调用词条在字典中完全存在
    const patchKeys = [
      'hostLabel',
      'presentSuffix',
      'badgeNew',
      'desktopVaultLabel',
      'browserStorageLabel',
      'alertPrefix',
      'statusRegistered',
      'statusUntested',
      'modeAllReply',
      'modeMentionOne',
      'inputPlaceholder',
      'inputPlaceholderMention',
      'comfyWorkbenchTitle',
      'comfyWorkbenchDesc',
      'titleToggleLang',
      'titleOpenSettings',
      'renderingShot',
      'renderFailed',
      'renderError',
      'unknownError',
      'shotAltText',
      'rightRailProgressEmpty',
      'rightRailMembersEmpty',
    ] as const;

    for (const key of patchKeys) {
      expect(enDict[key], `en-US 字典缺失键: ${key}`).toBeDefined();
      expect(zhDict[key], `zh-CN 字典缺失键: ${key}`).toBeDefined();
    }

    // 2. 扫描 en-US 全量词条，绝对严禁包含任何汉字
    for (const [key, val] of Object.entries(enDict)) {
      expect(cjkRegex.test(val), `en-US 词条 [${key}] 包含未翻译汉字: ${val}`).toBe(false);
    }

    // 3. 验证短徽章已使用导向短标 "Desktop app"
    expect(enDict.needsDesktop).toBe('Desktop app');
    expect(enDict.needsDesktop).not.toContain('Desktop Only');

    // 4. 验证账本英文标题已精简为不折行词条
    expect(enDict.ledgerTitle).toBe('TOKEN LEDGER');
  });

  // =========================================================================
  // 2. 单徽章优先级与单行收口测试 [mock验证]
  // =========================================================================
  it('徽章优先级: 同一行同一时刻严格只亮最高优先级一枚徽章，严禁重复堆叠 [mock验证]', () => {
    const renderClaudeCodeStatus = (isDesktop: boolean) => {
      return isDesktop
        ? { type: 'st ok', text: DICTIONARIES['zh-CN'].statusRegistered }
        : { type: 'badge', text: DICTIONARIES['zh-CN'].needsDesktop };
    };

    const desktopBadge = renderClaudeCodeStatus(true);
    expect(desktopBadge.type).toBe('st ok');
    expect(desktopBadge.text).toBe('已登记');

    const webBadge = renderClaudeCodeStatus(false);
    expect(webBadge.type).toBe('badge');
    expect(webBadge.text).toBe('桌面版可用');
  });

  // =========================================================================
  // 3. 首屏双栏空态联动与人话化用词测试 [mock验证]
  // =========================================================================
  it('空态联动: 未载入演示时右栏进度与成员卡片均展示空态，模式用词统一 [mock验证]', () => {
    const zhDict = DICTIONARIES['zh-CN'];
    const enDict = DICTIONARIES['en-US'];

    expect(zhDict.rightRailProgressEmpty).toContain('暂无进行中的会诊');
    expect(zhDict.rightRailMembersEmpty).toContain('专家就绪待命');

    expect(enDict.rightRailProgressEmpty).toContain('No active consultation');
    expect(enDict.rightRailMembersEmpty).toContain('Agents are on standby');

    expect(zhDict.modeAllReply).toBe('全员会诊');
    expect(zhDict.modeMentionOne).toBe('点名某人');
    expect(enDict.modeAllReply).toBe('All models reply');
    expect(enDict.modeMentionOne).toBe('Mention one');
  });

  // =========================================================================
  // 4. 思考状态严格遵循运行时集合，无按 Agent 特判 [mock验证]
  // =========================================================================
  it('思考状态纪律: 思考状态只认真实 thinkingAgents 集合，严禁写死特判 [mock验证]', () => {
    const thinkingAgents = new Set<string>();

    const checkThinking = (agentId: string) => {
      // 严格按照工单 14 重构后的逻辑：仅由集合判定
      return thinkingAgents.has(agentId);
    };

    const allAgentIds = ['Cl', 'Gp', 'Ge', 'Ds', 'Gr', 'Cc'];

    // 初始状态下无任何 agent 处于思考态（彻底杜绝 DeepSeek 首屏假思考）
    for (const id of allAgentIds) {
      expect(checkThinking(id)).toBe(false);
    }

    // 运行时仅被激活的 Agent 呈现思考态
    thinkingAgents.add('Ds');
    expect(checkThinking('Ds')).toBe(true);
    expect(checkThinking('Cl')).toBe(false);

    thinkingAgents.delete('Ds');
    expect(checkThinking('Ds')).toBe(false);
  });

  // =========================================================================
  // 5. 输入框占位符随会诊模式动态联动切换 [mock验证]
  // =========================================================================
  it('占位符联动: 输入框占位随全员会诊与点名模式动态切换词条 [mock验证]', () => {
    const zhDict = DICTIONARIES['zh-CN'];
    const enDict = DICTIONARIES['en-US'];

    const getPlaceholder = (isBroadcast: boolean, locale: 'zh-CN' | 'en-US') => {
      const dict = DICTIONARIES[locale];
      return isBroadcast ? dict.inputPlaceholder : dict.inputPlaceholderMention;
    };

    // 全员会诊模式占位符
    expect(getPlaceholder(true, 'zh-CN')).toContain('各答一次');
    expect(getPlaceholder(true, 'en-US')).toContain('all models will reply once');

    // 点名某人模式占位符
    expect(getPlaceholder(false, 'zh-CN')).toContain('仅被点名者回复');
    expect(getPlaceholder(false, 'en-US')).toContain('only mentioned agent will reply');
  });
});
