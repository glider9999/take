/**
 * @take/ui - settings-modal.dom.test.ts
 * 工单 17 真实 DOM 交互测试套件（happy-dom 真实环境） ［真跑验证］
 * 
 * 遵照工单 17 硬纪律：
 * 绝非 mock 源码字符串断言，而是把 SettingsModal 真实挂载进 document.body，
 * 用真实 click 事件完整驱动「打开 -> 点展开出输入框 -> 点收起 -> 点叉真关闭 -> 再次打开重测一轮」。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsModal } from '../src/components/SettingsModal.js';
import { KeyStore } from '@take/adapters';

describe('SettingsModal Real DOM Interactive Lifecycle (Ticket 17) [真跑验证]', () => {
  let fakeKeyStore: KeyStore;
  let storedKeys: Record<string, string>;

  beforeEach(() => {
    document.body.innerHTML = '';
    storedKeys = {};
    fakeKeyStore = {
      getKey: vi.fn(async (provider: string) => storedKeys[provider] || ''),
      setKey: vi.fn(async (provider: string, key: string) => {
        storedKeys[provider] = key;
      }),
      deleteKey: vi.fn(async (provider: string) => {
        delete storedKeys[provider];
      }),
      listKeys: vi.fn(async () => Object.keys(storedKeys)),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('完整验证真实 DOM 交互生命周期：展开呈现输入框 -> 收起隐藏 -> 点叉彻底注销 -> 再开一轮全部自洽 [真跑验证]', async () => {
    // -----------------------------------------------------------------------
    // 第一轮测试：初始挂载与交互
    // -----------------------------------------------------------------------
    let closeCalled = 0;
    const modal = new SettingsModal({
      keyStore: fakeKeyStore,
      onClose: () => {
        closeCalled++;
      },
    });

    // 1. 真实挂载到 document.body
    const element = await modal.render();
    modal.setMountedElement(element);
    document.body.appendChild(element);

    expect(document.body.querySelector('.modal-backdrop')).not.toBeNull();
    expect(document.body.contains(element)).toBe(true);

    // 初始状态下 deepseek 未配置，输入框不应存在
    let deepseekInput = document.body.querySelector('.key-input[data-provider="deepseek"]');
    expect(deepseekInput).toBeNull();

    // 2. 模拟真实点击「+ 添加 Key」展开按钮
    const expandBtn = document.body.querySelector<HTMLButtonElement>('.btn-toggle-expand[data-provider="deepseek"]');
    expect(expandBtn).not.toBeNull();

    expandBtn!.click();
    // 等待微任务队列完成异步安全换入
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 断言密码输入框真实出现在当前 document.body 中
    deepseekInput = document.body.querySelector<HTMLInputElement>('.key-input[data-provider="deepseek"]');
    expect(deepseekInput).not.toBeNull();
    expect(deepseekInput!.type).toBe('password');

    // 验证当前 mountedElement 依然与文档中的节点保持同一引用
    const currentMounted = modal.getElement();
    expect(document.body.contains(currentMounted)).toBe(true);
    expect(document.body.querySelector('.modal-backdrop')).toBe(currentMounted);

    // 3. 模拟真实点击「✕」收起按钮
    const collapseBtn = document.body.querySelector<HTMLButtonElement>('.btn-toggle-collapse[data-provider="deepseek"]');
    expect(collapseBtn).not.toBeNull();

    collapseBtn!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 断言输入框已恢复收起，重新变为紧凑行与添加按钮
    deepseekInput = document.body.querySelector('.key-input[data-provider="deepseek"]');
    expect(deepseekInput).toBeNull();
    const restoredExpandBtn = document.body.querySelector('.btn-toggle-expand[data-provider="deepseek"]');
    expect(restoredExpandBtn).not.toBeNull();

    // 4. 模拟真实点击右上角「✕」关闭按钮
    const closeBtn = document.body.querySelector<HTMLButtonElement>('#btn-close-modal');
    expect(closeBtn).not.toBeNull();

    closeBtn!.click();

    // 断言弹窗彻底从 document.body 中完全移除，不留孤儿节点
    expect(document.body.querySelector('.modal-backdrop')).toBeNull();
    expect(modal.getElement()).toBeNull();
    expect(closeCalled).toBe(1);

    // -----------------------------------------------------------------------
    // 第二轮测试：再次打开重复一轮，确保生命周期无状态残留
    // -----------------------------------------------------------------------
    const modalRound2 = new SettingsModal({
      keyStore: fakeKeyStore,
      onClose: () => {
        closeCalled++;
      },
    });

    const elRound2 = await modalRound2.render();
    modalRound2.setMountedElement(elRound2);
    document.body.appendChild(elRound2);

    expect(document.body.querySelector('.modal-backdrop')).toBe(elRound2);

    // 点击展开
    const expandBtnR2 = document.body.querySelector<HTMLButtonElement>('.btn-toggle-expand[data-provider="deepseek"]');
    expect(expandBtnR2).not.toBeNull();
    expandBtnR2!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 输入框出现并输入值
    const inputR2 = document.body.querySelector<HTMLInputElement>('.key-input[data-provider="deepseek"]');
    expect(inputR2).not.toBeNull();
    inputR2!.value = 'sk-test-deepseek-12345';

    // 点击保存
    const saveBtn = document.body.querySelector<HTMLButtonElement>('#btn-save-all-settings');
    expect(saveBtn).not.toBeNull();
    saveBtn!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 断言弹窗关闭且 Key 成功持久化
    expect(document.body.querySelector('.modal-backdrop')).toBeNull();
    expect(closeCalled).toBe(2);
    expect(storedKeys['deepseek']).toBe('sk-test-deepseek-12345');
  });

  it('页签切换与 DOM 显隐测试：点击不同页签正确切换显示对应内容面板 [真跑验证]', async () => {
    const modal = new SettingsModal({
      keyStore: fakeKeyStore,
      onClose: vi.fn(),
    });

    const el = await modal.render();
    modal.setMountedElement(el);
    document.body.appendChild(el);

    const paneProviders = document.body.querySelector<HTMLElement>('#pane-providers')!;
    const paneLocalTools = document.body.querySelector<HTMLElement>('#pane-local-tools')!;
    const paneLedger = document.body.querySelector<HTMLElement>('#pane-ledger')!;

    // 默认厂商页签可见
    expect(paneProviders.style.display).toBe('');
    expect(paneLocalTools.style.display).toBe('none');
    expect(paneLedger.style.display).toBe('none');

    // 切换到本地工具
    const tabLocalTools = document.body.querySelector<HTMLElement>('.tab[data-tab="local-tools"]')!;
    tabLocalTools.click();

    expect(paneProviders.style.display).toBe('none');
    expect(paneLocalTools.style.display).toBe('');
    expect(paneLedger.style.display).toBe('none');

    // 切换到账本
    const tabLedger = document.body.querySelector<HTMLElement>('.tab[data-tab="ledger"]')!;
    tabLedger.click();

    expect(paneProviders.style.display).toBe('none');
    expect(paneLocalTools.style.display).toBe('none');
    expect(paneLedger.style.display).toBe('');

    modal.close();
    expect(document.body.querySelector('.modal-backdrop')).toBeNull();
  });
});
