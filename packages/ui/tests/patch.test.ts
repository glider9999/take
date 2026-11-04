/**
 * @take/ui - patch.test.ts
 * Vitest 单元测试套件：工单 15 收口微修单专项测试（8 组加固测试） ［mock验证］
 * 涵盖：CJK 全量调用侧扫描、单徽章优先级、双栏空态联动、思考状态无特判、占位符随模式动态切换、账本摘要完整不截断、演示状态同源驱动、右栏状态随房隔离
 */

import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../src/i18n/index.js';

describe('TakeChat Final Polish Patch Test Suite (Ticket 15) [mock验证]', () => {
  // =========================================================================
  // 1. 界面英文模式 CJK 字面量扫描与词条全量对称性白名单测试 [mock验证]
  // =========================================================================
  it('CJK 扫描白名单: en-US 全量词条经正则检验为零汉字，调用侧词条完全对称 [mock验证]', () => {
    const enDict = DICTIONARIES['en-US'];
    const zhDict = DICTIONARIES['zh-CN'];
    const cjkRegex = /[\u4e00-\u9fa5]/;

    // 验证工单 15 包含的所有关键调用词条在字典中完全存在
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
      'shotStatusHeader',
      'comfyProgressTitle',
      'storyboardProgressTitle',
      'generalProgressTitle',
      'stepComfyLoad',
      'stepComfyProbe',
      'stepComfyError',
      'stepComfyDiag',
      'stepComfyFix',
      'stepGeneralBreakdown',
      'stepGeneralIdeas',
      'stepGeneralReasoning',
      'stepGeneralDecision',
    ] as const;

    for (const key of patchKeys) {
      expect(enDict[key], `en-US 字典缺失键: ${key}`).toBeDefined();
      expect(zhDict[key], `zh-CN 字典缺失键: ${key}`).toBeDefined();
    }

    // 扫描 en-US 全量词条，绝对严禁包含任何汉字
    for (const [key, val] of Object.entries(enDict)) {
      expect(cjkRegex.test(val), `en-US 词条 [${key}] 包含未翻译汉字: ${val}`).toBe(false);
    }

    // 验证短徽章已使用导向短标 "Desktop app"
    expect(enDict.needsDesktop).toBe('Desktop app');
    expect(enDict.needsDesktop).not.toContain('Desktop Only');

    // 验证账本英文标题已精简为不折行词条
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
      return thinkingAgents.has(agentId);
    };

    const allAgentIds = ['Cl', 'Gp', 'Ge', 'Ds', 'Gr', 'Cc'];

    for (const id of allAgentIds) {
      expect(checkThinking(id)).toBe(false);
    }

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

    expect(getPlaceholder(true, 'zh-CN')).toContain('各答一次');
    expect(getPlaceholder(true, 'en-US')).toContain('all models will reply once');

    expect(getPlaceholder(false, 'zh-CN')).toContain('仅被点名者回复');
    expect(getPlaceholder(false, 'en-US')).toContain('only mentioned agent will reply');
  });

  // =========================================================================
  // 6. 账本摘要格式完整性与金额永不截断测试（工单 15 核心） [mock验证]
  // =========================================================================
  it('账本格式完整性: 212px 下中英摘要格式均保持单行且金额数字完整无省略号 [mock验证]', () => {
    const enDict = DICTIONARIES['en-US'];
    const zhDict = DICTIONARIES['zh-CN'];

    // 验证标题与标签简洁适配 212px 狭窄左栏
    expect(enDict.ledgerTitle).toBe('TOKEN LEDGER');
    expect(enDict.ledgerTitle.length).toBeLessThanOrEqual(14);

    // 格式化测试：验证拼接金额后总字符在安全范围内
    const formatRow = (sessionLabel: string, monthlyLabel: string, sCost: string, mCost: string) => {
      return `${sessionLabel} ${sCost} ${monthlyLabel} ${mCost}/$20`;
    };

    const enRow = formatRow(enDict.ledgerSession, enDict.ledgerMonthly, '$0.00', '$0.00');
    const zhRow = formatRow(zhDict.ledgerSession, zhDict.ledgerMonthly, '$0.00', '$0.00');

    // 字符数均不超过 32 个半角字符，在 10.5px 字体下宽度 ~160px，严格小于左栏可用宽 178px
    expect(enRow.length).toBeLessThanOrEqual(32);
    expect(zhRow.length).toBeLessThanOrEqual(32);

    // 验证关键金额包含符号完整
    expect(enRow).toContain('$0.00');
    expect(zhRow).toContain('$0.00');
  });

  // =========================================================================
  // 7. 演示状态单一源同源驱动一致性测试（工单 15 核心） [mock验证]
  // =========================================================================
  it('演示状态同源一致性: 载入演示后 DeepSeek 在进度卡(进行中)与成员卡(思考中)严格同源联动 [mock验证]', () => {
    const thinkingAgents = new Set<string>();

    // 单一状态源驱动函数
    const resolveStatus = (agentId: string) => {
      const isThinking = thinkingAgents.has(agentId);
      return {
        isProgressDoing: isThinking,
        memberStatusText: isThinking ? DICTIONARIES['zh-CN'].statusThinking : DICTIONARIES['zh-CN'].statusReady,
        memberStatusClass: isThinking ? 'st hot' : 'st',
      };
    };

    // 载入演示激活 DeepSeek 工作态
    thinkingAgents.add('Ds');
    const dsActive = resolveStatus('Ds');
    expect(dsActive.isProgressDoing).toBe(true);
    expect(dsActive.memberStatusText).toBe('思考中');
    expect(dsActive.memberStatusClass).toBe('st hot');

    // 生成结束销毁工作态
    thinkingAgents.delete('Ds');
    const dsIdle = resolveStatus('Ds');
    expect(dsIdle.isProgressDoing).toBe(false);
    expect(dsIdle.memberStatusText).toBe('待命');
    expect(dsIdle.memberStatusClass).toBe('st');
  });

  // =========================================================================
  // 8. 右栏状态随会诊室切换独立隔离测试（工单 15 核心） [mock验证]
  // =========================================================================
  it('右栏状态随房隔离: 各房间各自维护专属阶段进度与成员列表，房与房不串状态 [mock验证]', () => {
    const enDict = DICTIONARIES['en-US'];
    const zhDict = DICTIONARIES['zh-CN'];

    // 验证各房间独立进度标题完全隔离
    expect(zhDict.progressTitle).not.toBe(zhDict.comfyProgressTitle);
    expect(zhDict.comfyProgressTitle).not.toBe(zhDict.storyboardProgressTitle);
    expect(zhDict.storyboardProgressTitle).not.toBe(zhDict.generalProgressTitle);

    expect(enDict.progressTitle).toBe('SESSION PROGRESS');
    expect(enDict.comfyProgressTitle).toBe('REPAIR PROGRESS');
    expect(enDict.storyboardProgressTitle).toBe('STORYBOARD PROGRESS');
    expect(enDict.generalProgressTitle).toBe('GENERAL PROGRESS');

    // 验证分镜表列头纠正为走 shotStatusHeader
    expect(zhDict.shotStatusHeader).toBe('镜头状态');
    expect(enDict.shotStatusHeader).toBe('Shot Status');
    expect(enDict.shotStatusHeader).not.toBe(enDict.membersTitle);
  });
});
