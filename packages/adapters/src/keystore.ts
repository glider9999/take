/**
 * @take/adapters - keystore.ts
 * 统一 Key 存取抽象接口与双实现语义（浏览器本地存储 vs 桌面原生钥匙串）
 */

export interface KeyStore {
  getKey(provider: string): Promise<string>;
  setKey(provider: string, apiKey: string): Promise<void>;
  deleteKey(provider: string): Promise<void>;
}

/**
 * 浏览器轻装版实现：存本地 LocalStorage（纯单机，完全不上传任何中心服务器）
 */
export class BrowserKeyStore implements KeyStore {
  private prefix = 'take_key_';
  private inMemoryFallback = new Map<string, string>();

  public async getKey(provider: string): Promise<string> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(this.prefix + provider) || '';
      }
    } catch {
      // 隐身模式或禁用 Storage 时回退内存
    }
    return this.inMemoryFallback.get(provider) || '';
  }

  public async setKey(provider: string, apiKey: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.prefix + provider, apiKey);
        return;
      }
    } catch {
      // 回退内存
    }
    this.inMemoryFallback.set(provider, apiKey);
  }

  public async deleteKey(provider: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.prefix + provider);
        return;
      }
    } catch {
      // 回退内存
    }
    this.inMemoryFallback.delete(provider);
  }
}

/**
 * 桌面完全版实现：通过注入的 IPC 桥梁调用工单 02 的 Rust 钥匙串命令（get_vault_key / set_vault_key）
 * 彻底杜绝在 TS 源码中硬编码 import @tauri-apps/api
 */
export type DesktopInvoker = (command: string, args: Record<string, unknown>) => Promise<unknown>;

export class DesktopKeyStore implements KeyStore {
  constructor(private invoker: DesktopInvoker) {}

  public async getKey(provider: string): Promise<string> {
    try {
      const res = await this.invoker('get_vault_key', { provider });
      return typeof res === 'string' ? res : '';
    } catch (err) {
      console.warn(`[DesktopKeyStore] 读取钥匙串 ${provider} 失败:`, err);
      return '';
    }
  }

  public async setKey(provider: string, apiKey: string): Promise<void> {
    await this.invoker('set_vault_key', { provider, key: apiKey });
  }

  public async deleteKey(provider: string): Promise<void> {
    await this.invoker('set_vault_key', { provider, key: '' });
  }
}

