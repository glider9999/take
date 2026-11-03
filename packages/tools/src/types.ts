/**
 * @take/tools - types.ts
 * 工具三级权限定义与执行契约（纯前端 TS，解耦 UI 弹窗）
 */

export type PermissionLevel = 'L1_readonly' | 'L2_preauthorized' | 'L3_destructive';

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  id: string;
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  execute: (args: TArgs) => Promise<TResult>;
}

export interface ToolExecutionRequest {
  toolId: string;
  toolName: string;
  permissionLevel: PermissionLevel;
  args: Record<string, unknown>;
  agentId?: string;
  description: string;
}

export type ConfirmationHandler = (request: ToolExecutionRequest) => Promise<boolean>;

export class PermissionDeniedError extends Error {
  constructor(message: string = '操作未获得授权') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

