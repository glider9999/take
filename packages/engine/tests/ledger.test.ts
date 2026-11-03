/**
 * @take/engine - ledger.test.ts
 * Vitest 单元测试套件：验证本地账本费率折算、会话与月度汇总、预算警戒线触发 ［mock验证］
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalLedger } from '../src/ledger.js';
import { UsageEvent } from '../src/types.js';

describe('LocalLedger Test Suite [mock验证]', () => {
  let ledger: LocalLedger;

  beforeEach(() => {
    ledger = new LocalLedger({ sessionLimitUsd: 1.0, monthlyLimitUsd: 10.0 });
  });

  it('费率折算：依据模型费率准确计算金额并记账 [mock验证]', () => {
    // claude-3-7-sonnet: input $0.003/1k, output $0.015/1k
    const usageEvent: UsageEvent = {
      type: 'usage',
      sessionId: 'sess-01',
      turnIndex: 1,
      agentId: 'claude',
      usage: {
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
      },
      timestamp: Date.now(),
    };

    // 预期开销: 1 * 0.003 + 2 * 0.015 = 0.003 + 0.03 = 0.033 USD
    const record = ledger.recordUsage(usageEvent, 'claude-3-7-sonnet');
    expect(record.costUsd).toBeCloseTo(0.033, 5);
    expect(record.totalTokens).toBe(3000);

    const summary = ledger.getSessionSummary('sess-01');
    expect(summary.totalTokens).toBe(3000);
    expect(summary.costUsd).toBeCloseTo(0.033, 4);
    expect(summary.isOverLimit).toBe(false);
  });

  it('会话与月度汇总：多轮多次多 Agent 正确累加 [mock验证]', () => {
    const now = Date.now();
    ledger.recordUsage({
      type: 'usage',
      sessionId: 'sess-A',
      turnIndex: 1,
      agentId: 'claude',
      usage: { inputTokens: 500, outputTokens: 500, totalTokens: 1000 },
      timestamp: now,
    }, 'gpt-4o');

    ledger.recordUsage({
      type: 'usage',
      sessionId: 'sess-A',
      turnIndex: 1,
      agentId: 'deepseek',
      usage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      timestamp: now + 100,
    }, 'deepseek-reasoner');

    const summaryA = ledger.getSessionSummary('sess-A');
    expect(summaryA.totalTokens).toBe(3000);
    expect(summaryA.costUsd).toBeGreaterThan(0);

    const monthly = ledger.getMonthlySummary();
    expect(monthly.totalTokens).toBe(3000);
  });

  it('警戒线软提醒：当会话开销超出预设阈值时触发警告回调，不阻断执行 [mock验证]', () => {
    const warningMock = vi.fn();
    ledger.setWarningCallback(warningMock);

    // 产生一笔单次超 $1.0 阈值的大请求
    // claude: input $0.003/1k, output $0.015/1k => 100k output = $1.5
    ledger.recordUsage({
      type: 'usage',
      sessionId: 'sess-heavy',
      turnIndex: 1,
      agentId: 'claude',
      usage: { inputTokens: 1000, outputTokens: 100000, totalTokens: 101000 },
      timestamp: Date.now(),
    }, 'claude-3-7-sonnet');

    expect(warningMock).toHaveBeenCalledTimes(1);
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('超出单会话预算警戒线'),
      true
    );

    const summary = ledger.getSessionSummary('sess-heavy');
    expect(summary.isOverLimit).toBe(true);
  });
});

