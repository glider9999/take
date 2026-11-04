/**
 * @take/ui - SettingsModal.ts
 * 设置面板组件：六大厂商 Key 配置、逐家「测试连接」自检与浏览器本地存储安全警示
 */

import { ConnectionTester, ConnectionTestResult, KeyStore } from '@take/adapters';
import { t } from '../i18n/index.js';

export interface SettingsModalOptions {
  keyStore: KeyStore;
  isDesktop?: boolean;
  onClose: () => void;
}

export class SettingsModal {
  private element: HTMLElement | null = null;
  private providers = [
    { id: 'anthropic', name: 'Anthropic (Claude)' },
    { id: 'openai', name: 'OpenAI (GPT-4o)' },
    { id: 'google', name: 'Google (Gemini 2.0)' },
    { id: 'deepseek', name: 'DeepSeek (R1 / V3)' },
    { id: 'moonshot', name: 'Kimi (Moonshot)' },
    { id: 'openrouter', name: 'OpenRouter' },
  ];

  constructor(private options: SettingsModalOptions) {}

  public async render(): Promise<HTMLElement> {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(28,26,23,0.5);
      display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    // 针对浏览器环境的安全警示
    const securityNotice = this.options.isDesktop
      ? `<div style="background:#F3EFE6;border:1px solid #E3DCCB;padding:10px 14px;border-radius:10px;font-size:12px;color:#57524A;margin-bottom:14px;">
           🔒 <b>桌面端安全保护</b>：API Key 经系统钥匙串（macOS Keychain / Windows Credential Manager）硬件级隔离加密保存。
         </div>`
      : `<div style="background:#FDF0EC;border:1.5px solid #C8402A;padding:10px 14px;border-radius:10px;font-size:12px;color:#C8402A;margin-bottom:14px;line-height:1.6;">
           ⚠️ <b>安全提示</b>：Key 只存于本浏览器本地存储（Local Storage），零中心服务器中转。<b>请勿在公共设备或他人电脑上填入高额度 Key！</b>
         </div>`;

    const savedKeys: Record<string, string> = {};
    let providerRows = '';
    for (const p of this.providers) {
      const savedKey = await this.options.keyStore.getKey(p.id);
      savedKeys[p.id] = savedKey;
      providerRows += `
        <div class="provider-setting-row" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #EFE9DD;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <b style="font-size:13.5px; color:#1C1A17">${p.name}</b>
            <button class="btn ghost btn-test-conn" data-provider="${p.id}" style="padding:4px 12px; font-size:12px;">测试连接</button>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="password" class="key-input" data-provider="${p.id}" value="" placeholder="输入 ${p.id} API Key..." style="flex:1; border:1px solid #E3DCCB; border-radius:8px; padding:7px 10px; font-size:13px; background:#FAF7F0;" />
          </div>
          <div class="test-feedback" data-feedback="${p.id}" style="font-size:11.5px; margin-top:5px; display:none;"></div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="win" style="max-width: 620px; width: 92%; max-height: 85vh; display:flex; flex-direction:column; background:#FAF7F0;">
        <div class="chrome" style="justify-content:space-between;">
          <b style="font-size:14px; color:#1C1A17;">${t('settings')} · 模型厂商与 API Key 管理</b>
          <button id="btn-close-modal" style="background:none; border:none; cursor:pointer; font-size:16px; color:#7A7368;">✕</button>
        </div>
        <div style="padding: 16px 20px; overflow-y:auto; flex:1;">
          ${securityNotice}
          <div class="provider-list">${providerRows}</div>
        </div>
        <div style="padding: 12px 20px; background:#F3EFE6; border-top:1px solid #E3DCCB; display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn red" id="btn-save-all-keys" style="padding:7px 20px;">保存配置</button>
        </div>
      </div>
    `;

    this.element = modal;
    this.bindEvents(modal);
    modal.querySelectorAll<HTMLInputElement>('.key-input').forEach((inp) => {
      const pid = inp.getAttribute('data-provider');
      if (pid && savedKeys[pid]) inp.value = savedKeys[pid];
    });
    return modal;
  }

  private bindEvents(modal: HTMLElement): void {
    // 关闭弹窗
    modal.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.close();
    });

    // 保存所有 Key
    modal.querySelector('#btn-save-all-keys')?.addEventListener('click', async () => {
      const inputs = modal.querySelectorAll<HTMLInputElement>('.key-input');
      for (const input of inputs) {
        const provider = input.getAttribute('data-provider');
        if (provider) {
          await this.options.keyStore.setKey(provider, input.value.trim());
        }
      }
      alert('所有配置已安全保存至本地！');
      this.close();
    });

    // 逐家「测试连接」自检
    modal.querySelectorAll<HTMLButtonElement>('.btn-test-conn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        if (!provider) return;

        const input = modal.querySelector<HTMLInputElement>(`.key-input[data-provider="${provider}"]`);
        const feedback = modal.querySelector<HTMLElement>(`[data-feedback="${provider}"]`);
        if (!feedback) return;

        const currentKey = input?.value.trim() || (await this.options.keyStore.getKey(provider));

        btn.disabled = true;
        btn.textContent = '测试中…';
        feedback.style.display = 'block';
        feedback.style.color = '#7A7368';
        feedback.textContent = '正在发起探测请求 (ping)...';

        const result: ConnectionTestResult = await ConnectionTester.testConnection(provider, currentKey);

        btn.disabled = false;
        btn.textContent = '测试连接';

        if (result.success) {
          feedback.style.color = '#2E7D32';
          feedback.textContent = `✓ 连通成功 · 响应耗时 ${result.latencyMs}ms (探测模型: ${result.modelId})`;
        } else {
          feedback.style.color = '#C8402A';
          if (result.isRateLimit) {
            feedback.textContent = `✗ 触发 429 速率限制 · 需在 ${result.retryAfterSeconds || 2}s 后重试 · 错误: ${result.errorMessage}`;
          } else {
            feedback.textContent = `✗ 连接失败 (${result.latencyMs}ms) · 原始错误: ${result.errorMessage}`;
          }
        }
      });
    });
  }

  public close(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
    this.options.onClose();
  }
}
