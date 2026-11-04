/**
 * @take/ui - patch.test.ts
 * Vitest 单元测试套件：工单 13 补丁单专项测试（CJK 硬编码扫描白名单、单徽章优先级、右栏空态联动） ［mock验证］
 */

import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../src/i18n/index.js';

describe('TakeChat Polish Patch Test Suite (Ticket 13) [mock验证]', () => {
  // =========================================================================
  // 1. 界面英文模式 CJK 字面量扫描与词条对称性白名单测试 [mock验证]
  // =========================================================================
  it('CJK 扫描白名单: en-US 词典全部词条经正则检验为零汉字，关键调用词条齐备 [mock验证]', () => {
    const enDict = DICTIONARIES['en-US'];
    const zhDict = DICTIONARIES['zh-CN'];
    const cjkRegex = /[\u4e00-\u9fa5]/;

    // 1. 验证工单 13 修复的关键漏网词条在字典中完全存在
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

    // 3. 验证短徽章已不再使用 "Desktop Only" 而是导向短标 "Desktop app"
    expect(enDict.needsDesktop).toBe('Desktop app');
    expect(enDict.needsDesktop).not.toContain('Desktop Only');

    // 4. 验证账本英文标题已精简为不折行词条
    expect(enDict.ledgerTitle).toBe('TOKEN LEDGER');
  });

  // =========================================================================
  // 2. 单徽章优先级与单行收口测试 [mock验证]
  // =========================================================================
  it('徽章优先级: 同一行同一时刻严格只亮最高优先级一枚徽章，严禁重复堆叠 [mock验证]', () => {
    // 模拟本地工具行在桌面与浏览器双端的徽章判定逻辑
    const renderClaudeCodeStatus = (isDesktop: boolean) => {
      return isDesktop
        ? { type: 'st ok', text: DICTIONARIES['zh-CN'].statusRegistered }
        : { type: 'badge', text: DICTIONARIES['zh-CN'].needsDesktop };
    };

    // 桌面版只显示「已登记」，不堆叠桌面提示
    const desktopBadge = renderClaudeCodeStatus(true);
    expect(desktopBadge.type).toBe('st ok');
    expect(desktopBadge.text).toBe('已登记');

    // 浏览器版只显示「桌面版可用」，不出现已登记按钮
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

    // 验证空态提示文本友好具备引导性
    expect(zhDict.rightRailProgressEmpty).toContain('暂无进行中的会诊');
    expect(zhDict.rightRailMembersEmpty).toContain('专家就绪待命');

    expect(enDict.rightRailProgressEmpty).toContain('No active consultation');
    expect(enDict.rightRailMembersEmpty).toContain('Agents are on standby');

    // 验证会诊模式主标签与副标题统一为人话化用词
    expect(zhDict.modeAllReply).toBe('全员会诊');
    expect(zhDict.modeMentionOne).toBe('点名某人');
    expect(enDict.modeAllReply).toBe('All models reply');
    expect(enDict.modeMentionOne).toBe('Mention one');
  });
});
