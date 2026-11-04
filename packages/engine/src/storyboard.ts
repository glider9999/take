/**
 * @take/engine - storyboard.ts
 * 分镜与镜头会诊室：结构化分镜卡（ShotCard）数据模型与分镜表汇总管理器
 * 特性：
 * 1. 结构化分镜卡：镜号、景别、画面描述、镜头提示词、状态（pending/rendered/finalized）、出图 URL；
 * 2. 镜号寻址覆盖：后写覆盖并留存最新状态；
 * 3. 分镜表聚合汇总：按镜号升序输出全量分镜表。
 */

export type ShotStatus = 'pending' | 'rendered' | 'finalized';

export interface ShotCard {
  shotNumber: number;
  shotScale: string;
  visualContent: string;
  prompt: string;
  status: ShotStatus;
  imageUrl?: string;
  updatedBy?: string;
  updatedAt?: number;
}

export class StoryboardManager {
  private shots = new Map<number, ShotCard>();

  constructor(initialShots: ShotCard[] = []) {
    for (const shot of initialShots) {
      this.upsertShot(shot);
    }
  }

  /**
   * 按镜号新增或更新分镜卡（按镜号寻址，后写覆盖）
   */
  public upsertShot(shot: ShotCard): ShotCard {
    if (!shot.shotNumber || shot.shotNumber <= 0) {
      throw new Error('分镜卡镜号必须为大于 0 的整数');
    }

    const existing = this.shots.get(shot.shotNumber);
    const updated: ShotCard = {
      shotNumber: shot.shotNumber,
      shotScale: shot.shotScale || existing?.shotScale || '全景',
      visualContent: shot.visualContent || existing?.visualContent || '',
      prompt: shot.prompt || existing?.prompt || '',
      status: shot.status || existing?.status || 'pending',
      imageUrl: shot.imageUrl ?? existing?.imageUrl,
      updatedBy: shot.updatedBy || existing?.updatedBy || 'assistant',
      updatedAt: shot.updatedAt || Date.now(),
    };

    this.shots.set(shot.shotNumber, updated);
    return updated;
  }

  /**
   * 获取指定镜号的分镜卡
   */
  public getShot(shotNumber: number): ShotCard | undefined {
    return this.shots.get(shotNumber);
  }

  /**
   * 绑定出图结果，并将状态流转至 rendered
   */
  public attachRenderedImage(shotNumber: number, imageUrl: string, updatedBy?: string): ShotCard {
    const shot = this.shots.get(shotNumber);
    if (!shot) {
      throw new Error(`未找到镜号为 [${shotNumber}] 的分镜卡`);
    }

    shot.imageUrl = imageUrl;
    shot.status = 'rendered';
    shot.updatedAt = Date.now();
    if (updatedBy) shot.updatedBy = updatedBy;

    this.shots.set(shotNumber, shot);
    return shot;
  }

  /**
   * 定稿分镜卡（状态流转至 finalized）
   */
  public finalizeShot(shotNumber: number, updatedBy?: string): ShotCard {
    const shot = this.shots.get(shotNumber);
    if (!shot) {
      throw new Error(`未找到镜号为 [${shotNumber}] 的分镜卡`);
    }

    shot.status = 'finalized';
    shot.updatedAt = Date.now();
    if (updatedBy) shot.updatedBy = updatedBy;

    this.shots.set(shotNumber, shot);
    return shot;
  }

  /**
   * 汇总全量分镜表，按镜号升序排列
   */
  public getStoryboardSummary(): ShotCard[] {
    return Array.from(this.shots.values()).sort((a, b) => a.shotNumber - b.shotNumber);
  }

  /**
   * 统计各状态数量
   */
  public getStats(): { total: number; pending: number; rendered: number; finalized: number } {
    let pending = 0;
    let rendered = 0;
    let finalized = 0;

    for (const s of this.shots.values()) {
      if (s.status === 'pending') pending++;
      else if (s.status === 'rendered') rendered++;
      else if (s.status === 'finalized') finalized++;
    }

    return {
      total: this.shots.size,
      pending,
      rendered,
      finalized,
    };
  }

  public clear(): void {
    this.shots.clear();
  }
}
