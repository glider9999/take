/**
 * @take/engine - ledger.ts
 * 本地真实财务账本：消费 usage 事件、按注册表费率自动折算金额、按会话/按月持久化与自设警戒线软提醒
 */

import { UsageEvent } from './types.js';

export interface ModelPricing {
  inputPer1kUsd: number;
  outputPer1kUsd: number;
}

export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-7-sonnet': { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
  'gpt-4o': { inputPer1kUsd: 0.0025, outputPer1kUsd: 0.01 },
  'gemini-2-0-flash': { inputPer1kUsd: 0.0001, outputPer1kUsd: 0.0004 },
  'deepseek-reasoner': { inputPer1kUsd: 0.00014, outputPer1kUsd: 0.00028 },
  'moonshot-v1-32k': { inputPer1kUsd: 0.0016, outputPer1kUsd: 0.0016 },
  'openrouter-auto': { inputPer1kUsd: 0.002, outputPer1kUsd: 0.008 },
};

export interface LedgerRecord {
  id: string;
  sessionId: string;
  agentId: string;
  modelId: string;
  turnIndex: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  timestamp: number;
  yearMonth: string; // YYYY-MM
}

export interface LedgerLimits {
  sessionLimitUsd: number;
  monthlyLimitUsd: number;
}

export interface LedgerSummary {
  totalTokens: number;
  costUsd: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

export class LocalLedger {
  private records: LedgerRecord[] = [];
  private limits: LedgerLimits = { sessionLimitUsd: 2.0, monthlyLimitUsd: 20.0 };
  private onWarningCallback?: (message: string, isOverLimit: boolean) => void;
  private pricingMap: Record<string, ModelPricing> = { ...DEFAULT_MODEL_PRICING };

  constructor(limits?: Partial<LedgerLimits>) {
    if (limits) this.limits = { ...this.limits, ...limits };
    this.loadFromStorage();
  }

  public setWarningCallback(cb: (message: string, isOverLimit: boolean) => void): void {
    this.onWarningCallback = cb;
  }

  public setLimits(limits: Partial<LedgerLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  public setModelPricing(modelId: string, pricing: ModelPricing): void {
    this.pricingMap[modelId] = pricing;
  }

  /**
   * 消费引擎派发的 usage 事件并记录折算金额
   */
  public recordUsage(event: UsageEvent, modelId: string = 'gpt-4o'): LedgerRecord {
    const pricing = this.pricingMap[modelId] || { inputPer1kUsd: 0.002, outputPer1kUsd: 0.006 };
    const cost =
      (event.usage.inputTokens / 1000) * pricing.inputPer1kUsd +
      (event.usage.outputTokens / 1000) * pricing.outputPer1kUsd;

    const date = new Date(event.timestamp);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const record: LedgerRecord = {
      id: `rec-${event.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: event.sessionId,
      agentId: event.agentId,
      modelId,
      turnIndex: event.turnIndex,
      inputTokens: event.usage.inputTokens,
      outputTokens: event.usage.outputTokens,
      totalTokens: event.usage.totalTokens,
      costUsd: parseFloat(cost.toFixed(6)),
      timestamp: event.timestamp,
      yearMonth,
    };

    this.records.push(record);
    this.saveToStorage();
    this.checkThresholds(event.sessionId, yearMonth);

    return record;
  }

  /**
   * 汇总指定会话的财务开销
   */
  public getSessionSummary(sessionId: string): LedgerSummary {
    const sessionRecords = this.records.filter((r) => r.sessionId === sessionId);
    const totalTokens = sessionRecords.reduce((sum, r) => sum + r.totalTokens, 0);
    const costUsd = parseFloat(sessionRecords.reduce((sum, r) => sum + r.costUsd, 0).toFixed(4));

    return {
      totalTokens,
      costUsd,
      isNearLimit: costUsd >= this.limits.sessionLimitUsd * 0.8,
      isOverLimit: costUsd >= this.limits.sessionLimitUsd,
    };
  }

  /**
   * 汇总指定月份的总开销
   */
  public getMonthlySummary(yearMonth?: string): LedgerSummary {
    const ym = yearMonth || this.getCurrentYearMonth();
    const monthlyRecords = this.records.filter((r) => r.yearMonth === ym);
    const totalTokens = monthlyRecords.reduce((sum, r) => sum + r.totalTokens, 0);
    const costUsd = parseFloat(monthlyRecords.reduce((sum, r) => sum + r.costUsd, 0).toFixed(4));

    return {
      totalTokens,
      costUsd,
      isNearLimit: costUsd >= this.limits.monthlyLimitUsd * 0.8,
      isOverLimit: costUsd >= this.limits.monthlyLimitUsd,
    };
  }

  public getLimits(): LedgerLimits {
    return { ...this.limits };
  }

  private checkThresholds(sessionId: string, yearMonth: string): void {
    const sSummary = this.getSessionSummary(sessionId);
    const mSummary = this.getMonthlySummary(yearMonth);

    if (sSummary.isOverLimit) {
      this.onWarningCallback?.(
        `本次会话已消耗 $${sSummary.costUsd.toFixed(2)}，超出单会话预算警戒线 $${this.limits.sessionLimitUsd.toFixed(2)}（不强制锁死）`,
        true
      );
    } else if (mSummary.isOverLimit) {
      this.onWarningCallback?.(
        `本月账本已消耗 $${mSummary.costUsd.toFixed(2)}，超出每月预算警戒线 $${this.limits.monthlyLimitUsd.toFixed(2)}（不强制锁死）`,
        true
      );
    }
  }

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('take_ledger_records', JSON.stringify(this.records.slice(-500)));
      }
    } catch {
      // 内存模式
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('take_ledger_records');
        if (raw) {
          this.records = JSON.parse(raw);
        }
      }
    } catch {
      this.records = [];
    }
  }
}

