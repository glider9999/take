/**
 * @take/adapters - http-client.ts
 * 单一 fetch 抽象网关：实现 HTTP 双环境抽象（桌面/浏览器环境无缝切换）
 * 红线遵守：本模块严禁直接依赖或 import 任何 @tauri-apps/api
 */

export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let activeFetchClient: FetchFunction = (...args) => globalThis.fetch(...args);

/**
 * 切换底层 HTTP 实现（例如桌面端注入 Tauri HTTP 客户端或测试环境注入 Mock Fetch）
 */
export function setFetchClient(customFetch: FetchFunction): void {
  activeFetchClient = customFetch;
}

/**
 * 获取当前激活的 HTTP 客户端实例
 */
export function getFetchClient(): FetchFunction {
  return activeFetchClient;
}

/**
 * 标准通用 fetch 调用入口
 */
export async function universalFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  return activeFetchClient(url, init);
}

