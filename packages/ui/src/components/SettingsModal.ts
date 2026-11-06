/**
 * @take/ui - settings-modal.ts (工单 19 扩容版)
 * 厂商列表增至 12 行（增加 NVIDIA，nvapi- 前缀）
 */

import { ConnectionTester, ConnectionTestResult, KeyStore, ComfyUiAdapter, DEFAULT_COMFYUI_URL } from '@take/adapters';
import { LocalLedger } from '@take/engine';
import { t } from '../i18n/index.js';

export interface SettingsModalOptions {
  keyStore: KeyStore;
  ledger?: LocalLedger;
  isDesktop?: boolean;
  onClose: () => void;
  onKeysChanged?: () => void;
}

export interface ProviderConfig {
  id: string;
  name: string;
  placeholder?: string;
  allowCustomModel?: boolean;
}

export class SettingsModal {
  private mountedElement: HTMLElement | null = null;
  private currentTab: 'providers' | 'local-tools' | 'ledger' = 'providers';
  private expandedProviders: Set<string> = new Set();

  public readonly providers: ProviderConfig[] = [
    { id: 'deepseek', name: 'DeepSeek', placeholder: 'API Key…' },
    { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-…' },
    { id: 'openai', name: 'OpenAI', placeholder: 'sk-…' },
    { id: 'google', name: 'Google Gemini', placeholder: 'AIza…' },
    { id: 'moonshot', name: 'Moonshot (Kimi)', placeholder: 'sk-…' },
    { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-…' },
    { id: 'xai', name: 'xAI (Grok)', placeholder: 'xai-…' },
    { id: 'qwen', name: '通义千问 (Qwen)', placeholder: 'sk-…' },
    { id: 'zhipu', name: '智谱 (GLM)', placeholder: 'API Key…' },
    { id: 'doubao', name: '豆包 (火山方舟)', placeholder: 'API Key…', allowCustomModel: true },
    { id: 'minimax', name: 'MiniMax', placeholder: 'API Key…' },
    // 工单 19 新增第 12 家：NVIDIA (nvapi- 前缀)
    { id: 'nvidia', name: 'NVIDIA', placeholder: 'nvapi-…' },
  ];

  constructor(private options: SettingsModalOptions) {}

  public getElement(): HTMLElement | null {
    return this.mountedElement;
  }

  public setMountedElement(el: HTMLElement | null): void {
    this.mountedElement = el;
  }

  public async render(): Promise<HTMLElement> {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const securityNotice = this.options.isDesktop
      ? `<div style="background:#F3EFE6;border:1px solid #E3DCCB;padding:8px 12px;border-radius:8px;font-size:12px;color:#57524A;margin-bottom:12px;">
           🔒 <b>${t('desktopVaultLabel')}</b>
         </div>`
      : `<div style="background:#FDF0EC;border:1px solid #E8B4A8;padding:8px 12px;border-radius:8px;font-size:12px;color:#C8402A;margin-bottom:12px;">
           ⚠️ <b>${t('browserStorageLabel')}</b>: ${t('browserKeyWarning')}
         </div>`;

    let providerRows = '';
    for (const p of this.providers) {
      const savedKey = await this.options.keyStore.getKey(p.id);
      const isExpanded = Boolean(savedKey) || this.expandedProviders.has(p.id);

      if (!isExpanded) {
        providerRows += `
          <div class="vrow compact-vrow" data-provider="${p.id}">
            <div class="vn">${p.name}</div>
            <div class="st none" style="flex:1;">${t('statusNoKey')}</div>
            <button class="tb btn-toggle-expand" data-provider="${p.id}">${t('addKey')}</button>
          </div>
        `;
      } else {
        const extraInput = p.allowCustomModel
          ? `<input type="text" class="key model-input" data-provider="${p.id}" placeholder="Endpoint/Model ID (如 ep-… 或 doubao-lite-128k)" style="width:240px;margin-left:6px;font-size:12px;" />`
          : '';

        providerRows += `
          <div class="vrow" data-provider="${p.id}">
            <div class="vn">${p.name}</div>
            <input type="password" class="key key-input" data-provider="${p.id}" value="${savedKey || ''}" placeholder="${p.placeholder || 'API Key…'}" />
            ${extraInput}
            <div class="st ${savedKey ? 'ok' : 'none'}" data-status="${p.id}">${savedKey ? t('connSuccess') : t('statusNoKey')}</div>
            <button class="tb btn-test-conn" data-provider="${p.id}">${t('testConn')}</button>
            ${
              savedKey
                ? `<button class="tb btn-delete-key" data-provider="${p.id}" style="color:#C8402A;border-color:#E8B4A8;padding:4px 9px;">${t('deleteKey')}</button>`
                : `<button class="tb btn-toggle-collapse" data-provider="${p.id}" style="padding:4px 8px;font-size:11px;opacity:0.7;">✕</button>`
            }
          </div>
        `;
      }
    }

    const savedComfyUrl = ComfyUiAdapter.getSavedEndpoint() || DEFAULT_COMFYUI_URL;
    const claudeCodeBadgeHtml = this.options.isDesktop
      ? `<div class="st ok" style="text-align:right;">${t('statusRegistered')}</div>`
      : `<div class="st none" style="text-align:right;"><span class="badge">${t('needsDesktop')}</span></div>`;

    const limits = this.options.ledger?.getLimits() || { sessionLimitUsd: 2.0, monthlyLimitUsd: 20.0 };

    backdrop.innerHTML = `
      <div class="modal">
        <div class="mh">
          <div class="tab ${this.currentTab === 'providers' ? 'on' : ''}" data-tab="providers">${t('tabProviders')}</div>
          <div class="tab ${this.currentTab === 'local-tools' ? 'on' : ''}" data-tab="local-tools">${t('tabLocalTools')}</div>
          <div class="tab ${this.currentTab === 'ledger' ? 'on' : ''}" data-tab="ledger">${t('tabLedger')}</div>
          <div style="flex:1"></div>
          <button id="btn-close-modal" style="background:none;border:none;cursor:pointer;font-size:16px;color:#7A7368;padding:8px 12px;">✕</button>
        </div>

        <div class="mb">
          <!-- 页签 1: 厂商与 Key (12 家) -->
          <div class="tab-pane" id="pane-providers" style="${this.currentTab === 'providers' ? '' : 'display:none;'}">
            ${securityNotice}
            <div class="provider-list">${providerRows}</div>
          </div>

          <!-- 页签 2: 本地工具 -->
          <div class="tab-pane" id="pane-local-tools" style="${this.currentTab === 'local-tools' ? '' : 'display:none;'}">
            <div class="vrow">
              <div class="vn">Claude Code</div>
              <div class="key" style="color:#7A7368;font-size:12px;background:#FAF7F0;">stdio JSON-RPC · acp-claude</div>
              ${claudeCodeBadgeHtml}
            </div>
            <div class="vrow">
              <div class="vn">ComfyUI</div>
              <input type="text" class="key" id="comfyui-endpoint-input" value="${savedComfyUrl}" placeholder="http://127.0.0.1:8188" />
              <div class="st none" id="comfyui-status">${t('statusUntested')}</div>
              <button class="tb" id="btn-test-comfyui">${t('testConn')}</button>
            </div>
            <div style="font-size:11.5px;color:#7A7368;padding:6px 4px;line-height:1.6;">
              ${t('comfyEndpointHint')}
            </div>
          </div>

          <!-- 页签 3: 账本与警戒线 -->
          <div class="tab-pane" id="pane-ledger" style="${this.currentTab === 'ledger' ? '' : 'display:none;'}">
            <div class="vrow">
              <div class="vn">${t('sessionLimitLabel')}</div>
              <input type="number" step="0.5" min="0.1" class="key" id="session-limit-input" value="${limits.sessionLimitUsd}" />
              <div class="st none" id="session-limit-tip">${t('alertPrefix')}: $${limits.sessionLimitUsd}</div>
            </div>
            <div class="vrow">
              <div class="vn">${t('monthlyLimitLabel')}</div>
              <input type="number" step="1.0" min="1.0" class="key" id="monthly-limit-input" value="${limits.monthlyLimitUsd}" />
              <div class="st none" id="monthly-limit-tip">${t('alertPrefix')}: $${limits.monthlyLimitUsd}</div>
            </div>
            <div style="font-size:12px;color:#57524A;padding:8px 4px;line-height:1.6;">
              ${t('ledgerTip')}
            </div>
          </div>
        </div>

        <div style="padding:12px 20px;background:#F3EFE6;border-top:1px solid #E3DCCB;display:flex;justify-content:flex-end;gap:10px;">
          <button class="send" id="btn-save-all-settings" style="padding:8px 22px;">${t('saveConfig')}</button>
        </div>
      </div>
    `;

    this.bindEvents(backdrop);
    return backdrop;
  }

  private async safeReRender(): Promise<void> {
    const oldElement = this.mountedElement;
    const newElement = await this.render();

    if (oldElement && oldElement.parentNode) {
      oldElement.parentNode.replaceChild(newElement, oldElement);
    }
    this.mountedElement = newElement;
  }

  private bindEvents(modal: HTMLElement): void {
    modal.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.close();
    });

    modal.querySelectorAll('.tab[data-tab]').forEach((tabEl) => {
      tabEl.addEventListener('click', () => {
        const tabKey = tabEl.getAttribute('data-tab') as 'providers' | 'local-tools' | 'ledger';
        if (!tabKey) return;
        this.currentTab = tabKey;

        modal.querySelectorAll('.tab').forEach((el) => el.classList.remove('on'));
        tabEl.classList.add('on');

        const panes = ['providers', 'local-tools', 'ledger'];
        panes.forEach((p) => {
          const paneEl = modal.querySelector(`#pane-${p}`) as HTMLElement;
          if (paneEl) {
            paneEl.style.display = p === tabKey ? '' : 'none';
          }
        });
      });
    });

    modal.querySelectorAll<HTMLButtonElement>('.btn-toggle-expand').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pId = btn.getAttribute('data-provider');
        if (pId) {
          this.expandedProviders.add(pId);
          await this.safeReRender();
        }
      });
    });

    modal.querySelectorAll<HTMLButtonElement>('.btn-toggle-collapse').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pId = btn.getAttribute('data-provider');
        if (pId) {
          this.expandedProviders.delete(pId);
          await this.safeReRender();
        }
      });
    });

    modal.querySelectorAll<HTMLButtonElement>('.btn-delete-key').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pId = btn.getAttribute('data-provider');
        if (!pId) return;

        const confirmed = typeof window !== 'undefined' && window.confirm
          ? window.confirm(t('confirmDeleteKey'))
          : true;

        if (confirmed) {
          await this.options.keyStore.deleteKey(pId);
          this.expandedProviders.delete(pId);
          this.options.onKeysChanged?.();
          await this.safeReRender();
        }
      });
    });

    modal.querySelector('#btn-save-all-settings')?.addEventListener('click', async () => {
      const inputs = modal.querySelectorAll<HTMLInputElement>('.key-input');
      for (const input of inputs) {
        const provider = input.getAttribute('data-provider');
        if (provider) {
          const val = input.value.trim();
          if (val) {
            await this.options.keyStore.setKey(provider, val);
          }
        }
      }

      const comfyInput = modal.querySelector<HTMLInputElement>('#comfyui-endpoint-input');
      if (comfyInput) {
        ComfyUiAdapter.saveEndpoint(comfyInput.value);
      }

      const sessionInput = modal.querySelector<HTMLInputElement>('#session-limit-input');
      const monthlyInput = modal.querySelector<HTMLInputElement>('#monthly-limit-input');
      if (sessionInput && monthlyInput && this.options.ledger) {
        const sVal = parseFloat(sessionInput.value) || 2.0;
        const mVal = parseFloat(monthlyInput.value) || 20.0;
        this.options.ledger.setLimits({ sessionLimitUsd: sVal, monthlyLimitUsd: mVal });
      }

      this.options.onKeysChanged?.();
      this.close();
    });

    modal.querySelectorAll<HTMLButtonElement>('.btn-test-conn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        if (!provider) return;

        const input = modal.querySelector<HTMLInputElement>(`.key-input[data-provider="${provider}"]`);
        const modelInput = modal.querySelector<HTMLInputElement>(`.model-input[data-provider="${provider}"]`);
        const statusEl = modal.querySelector<HTMLElement>(`[data-status="${provider}"]`);
        if (!statusEl) return;

        const currentKey = input?.value.trim() || (await this.options.keyStore.getKey(provider));
        const customModelId = modelInput?.value.trim() || undefined;

        btn.disabled = true;
        btn.textContent = t('testingConn');
        statusEl.className = 'st none';
        statusEl.textContent = t('testingConn');

        const result: ConnectionTestResult = await ConnectionTester.testConnection(
          provider,
          currentKey,
          undefined,
          customModelId
        );

        btn.disabled = false;
        btn.textContent = t('testConn');

        if (result.success) {
          statusEl.className = 'st ok';
          statusEl.textContent = `✓ ${t('connSuccess')} · ${result.latencyMs}ms`;
        } else {
          statusEl.className = 'st err';
          if (result.isRateLimit) {
            statusEl.textContent = `✗ 429 (${result.retryAfterSeconds || 2}s)`;
          } else {
            const errStr = result.errorMessage || t('connFailed');
            statusEl.textContent = `✗ ${t('connFailed')} · ${errStr.slice(0, 24)}`;
          }
        }
      });
    });

    const btnTestComfy = modal.querySelector<HTMLButtonElement>('#btn-test-comfyui');
    const comfyInput = modal.querySelector<HTMLInputElement>('#comfyui-endpoint-input');
    const comfyStatus = modal.querySelector<HTMLElement>('#comfyui-status');

    btnTestComfy?.addEventListener('click', async () => {
      if (!comfyStatus || !comfyInput) return;

      const endpoint = comfyInput.value.trim() || DEFAULT_COMFYUI_URL;
      const adapter = new ComfyUiAdapter(endpoint);

      btnTestComfy.disabled = true;
      btnTestComfy.textContent = t('testingConn');
      comfyStatus.className = 'st none';
      comfyStatus.textContent = t('testingConn');

      const result = await adapter.testConnection();

      btnTestComfy.disabled = false;
      btnTestComfy.textContent = t('testConn');

      if (result.success) {
        comfyStatus.className = 'st ok';
        comfyStatus.textContent = `✓ ${t('connSuccess')} · ${result.latencyMs}ms (${result.version || 'v0.3+'})`;
      } else {
        comfyStatus.className = 'st err';
        const errStr = result.errorMessage || t('connFailed');
        comfyStatus.textContent = `✗ ${t('connFailed')} · ${errStr.slice(0, 24)}`;
      }
    });
  }

  public close(): void {
    const target = this.mountedElement;
    if (target && target.parentNode) {
      target.parentNode.removeChild(target);
      this.mountedElement = null;
    }
    this.options.onClose();
  }
}
