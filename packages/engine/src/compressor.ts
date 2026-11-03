/**
 * @take/engine - compressor.ts
 * 上下文压缩模块：Token 估算、近 10 条滑动截断、结构化摘要生成与 200 字硬约束
 */

import { Message, StructuredSummary } from './types.js';

export interface CompressorConfig {
  maxWindowMessages: number;
  maxSummaryTokens: number;
  enabled: boolean;
}

export const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
  maxWindowMessages: 10,
  maxSummaryTokens: 200,
  enabled: true,
};

export class ContextCompressor {
  private config: CompressorConfig;

  constructor(config: Partial<CompressorConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSOR_CONFIG, ...config };
  }

  /**
   * 纯前端轻量 Token 估算：按 CJK 字符与英文单词混合加权估算
   */
  public estimateTokens(text: string): number {
    if (!text) return 0;
    let tokens = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // 中日韩字符通常约 0.6~0.8 个 token
      if (code >= 0x4e00 && code <= 0x9fa5) {
        tokens += 0.8;
      } else {
        // ASCII 字符约 0.25 个 token (4 chars = 1 token)
        tokens += 0.25;
      }
    }
    return Math.ceil(tokens);
  }

  /**
   * 执行历史滑动截断与早期历史提取
   */
  public sliceHistory(history: Message[]): {
    retained: Message[];
    overflow: Message[];
  } {
    if (!this.config.enabled || history.length <= this.config.maxWindowMessages) {
      return { retained: [...history], overflow: [] };
    }

    const cutIndex = history.length - this.config.maxWindowMessages;
    return {
      retained: history.slice(cutIndex),
      overflow: history.slice(0, cutIndex),
    };
  }

  /**
   * 将溢出的旧历史压缩为 200 字以内的结构化摘要
   */
  public buildStructuredSummary(overflow: Message[]): string {
    if (overflow.length === 0) return '';

    const summary: StructuredSummary = {
      background: '早期多模型协作讨论',
      keyFindings: '',
      decisions: '',
      codeOrData: '',
    };

    const keyPoints: string[] = [];
    for (const msg of overflow) {
      const shortContent = msg.content.trim().slice(0, 40);
      keyPoints.push(`[${msg.senderName}]: ${shortContent}`);
    }

    summary.keyFindings = keyPoints.slice(-4).join('; ');
    summary.decisions = `共归档 ${overflow.length} 条早期对话`;

    const rawSummary = `【历史摘要】背景:${summary.background} | 概要:${summary.keyFindings} | 状态:${summary.decisions}`;
    
    // 严格限制在 200 字/Token 约束内
    if (rawSummary.length > 200) {
      return rawSummary.slice(0, 197) + '...';
    }
    return rawSummary;
  }
}

