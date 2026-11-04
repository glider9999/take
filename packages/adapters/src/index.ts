/**
 * @take/adapters - index.ts
 * 统一导出所有连接层适配器（云端 API、ACP 结构化 CLI、老式 PTY 终端与 ComfyUI）
 * 注：旧 ACP 适配器（acp-cli-adapter.ts）退役，统一收敛至 acp-protocol-adapter.ts
 */

export * from './http-client.js';
export * from './keystore.js';
export * from './cloud-api-adapter.js';
export * from './acp-protocol-adapter.js';
export * from './pty-cli-adapter.js';
export * from './comfyui-adapter.js';
export * from './connection-tester.js';
