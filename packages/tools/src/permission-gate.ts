/**
 * @take/tools - permission-gate.ts
 * 工具三级权限统一执行门（L1 自动执行 / L2 预授权 / L3 破坏性强确认）
 * 彻底解耦 UI：确认行为经 ConfirmationHandler 依赖注入
 */

import {
  ToolDefinition,
  ToolExecutionRequest,
  ConfirmationHandler,
  PermissionDeniedError,
} from './types.js';

export class PermissionGate {
  private registeredTools = new Map<string, ToolDefinition<any, any>>();
  private preAuthorizedTools = new Set<string>();

  constructor(private confirmationHandler?: ConfirmationHandler) {}

  /**
   * 注册可用工具（数据驱动）
   */
  public registerTool<TArgs, TResult>(tool: ToolDefinition<TArgs, TResult>): void {
    this.registeredTools.set(tool.id, tool);
  }

  /**
   * 用户在设置面板中预授权某项 L2 工具
   */
  public grantPreAuthorization(toolId: string): void {
    this.preAuthorizedTools.add(toolId);
  }

  /**
   * 撤销某项 L2 工具的预授权
   */
  public revokePreAuthorization(toolId: string): void {
    this.preAuthorizedTools.delete(toolId);
  }

  /**
   * 动态设置确认处理器（UI 弹窗注入）
   */
  public setConfirmationHandler(handler: ConfirmationHandler): void {
    this.confirmationHandler = handler;
  }

  /**
   * 核心执行网关：按照 L1/L2/L3 权限阶梯裁定放行或拦截
   */
  public async execute<TArgs extends Record<string, unknown>, TResult>(
    toolId: string,
    args: TArgs,
    agentId?: string
  ): Promise<TResult> {
    const tool = this.registeredTools.get(toolId);
    if (!tool) {
      throw new Error(`未注册的工具: ${toolId}`);
    }

    const request: ToolExecutionRequest = {
      toolId: tool.id,
      toolName: tool.name,
      permissionLevel: tool.permissionLevel,
      args,
      agentId,
      description: tool.description,
    };

    // 1. L1 只读工具：零摩擦直接放行
    if (tool.permissionLevel === 'L1_readonly') {
      return tool.execute(args) as Promise<TResult>;
    }

    // 2. L2 写入/局部操作：检查设置中是否预授权
    if (tool.permissionLevel === 'L2_preauthorized') {
      if (this.preAuthorizedTools.has(tool.id)) {
        return tool.execute(args) as Promise<TResult>;
      }
      // 未预授权时退回给确认处理器做单次授权
      if (this.confirmationHandler) {
        const approved = await this.confirmationHandler(request);
        if (approved) {
          return tool.execute(args) as Promise<TResult>;
        }
      }
      throw new PermissionDeniedError(`L2 工具 [${tool.name}] 未在设置中获得预授权且未获单次批准`);
    }

    // 3. L3 破坏性操作（执行 Shell / 删除文件 / 外发）：强制每次二次确认
    if (tool.permissionLevel === 'L3_destructive') {
      if (!this.confirmationHandler) {
        throw new PermissionDeniedError(`系统未挂载确认处理器，已拒绝高危 L3 操作: ${tool.name}`);
      }
      const approved = await this.confirmationHandler(request);
      if (!approved) {
        throw new PermissionDeniedError(`用户拒绝执行高危 L3 破坏性操作: ${tool.name}`);
      }
      return tool.execute(args) as Promise<TResult>;
    }

    throw new PermissionDeniedError(`未知的权限级别: ${tool.permissionLevel}`);
  }

  public getRegisteredToolIds(): string[] {
    return Array.from(this.registeredTools.keys());
  }
}

