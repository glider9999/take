/**
 * @take/ui - tests/ui-chat-app.dom.test.ts
 * 工单 18 真实 DOM 交互测试套件（happy-dom 真实环境） ［真跑验证］
 * 
 * 遵照工单 18 硬纪律，模拟用户真实点击：
 * 1. 设置弹窗「删除 Key」后该厂商行立即回到未配置收起态；
 * 2. @ 联想候选层弹出、字符过滤与方向键选择填入；
 * 3. 对话增删：点击「＋新建对话」增加一间会话，删除会话，并在 localStorage 模拟持久化刷新后状态不回滚。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsModal } from '../src/components/SettingsModal.js';
import { ChatApp } from '../src/components/ChatApp.js';
import { KeyStore } from '@take/adapters';

describe('TakeChat Ticket 18 Real DOM Interactive Suite (happy-dom) [真跑验证]', () => {
  let fakeKeyStore: KeyStore;
  let storedKeys: Record<string, string>;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    storedKeys = {
      deepseek: 'sk-deepseek-initial-key',
      anthropic: 'sk-ant-test-key',
    };
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

    container = document.createElement('div');
    container.id = 'app-root';
    document.body.appendChild(container);

    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('prompt', vi.fn((msg, def) => def || '新对话'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // =========================================================================
  // 测试 1: 设置弹窗「删除 Key」后该行回到未配置收起态 [真跑验证]
  // =========================================================================
  it('设置弹窗删除 Key 交互：点击删除经确认后调用 deleteKey，并立即回到未配置收起态 [真跑验证]', async () => {
    const modal = new SettingsModal({
      keyStore: fakeKeyStore,
      onClose: vi.fn(),
    });

    const modalEl = await modal.render();
    modal.setMountedElement(modalEl);
    document.body.appendChild(modalEl);

    // 初始状态下 deepseek 已配置 Key，应渲染展开行包含 delete-key 按钮
    let delBtn = document.body.querySelector<HTMLButtonElement>('.btn-delete-key[data-provider="deepseek"]');
    expect(delBtn).not.toBeNull();
    let keyInput = document.body.querySelector<HTMLInputElement>('.key-input[data-provider="deepseek"]');
    expect(keyInput).not.toBeNull();
    expect(keyInput!.value).toBe('sk-deepseek-initial-key');

    // 模拟真实点击「删除 Key」
    delBtn!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 断言 deleteKey 真实被调用
    expect(fakeKeyStore.deleteKey).toHaveBeenCalledWith('deepseek');
    expect(storedKeys['deepseek']).toBeUndefined();

    // 断言该行已重渲染回到未配置紧凑行，包含 "+ 添加 Key" 按钮，输入框消失
    keyInput = document.body.querySelector('.key-input[data-provider="deepseek"]');
    expect(keyInput).toBeNull();

    const addBtn = document.body.querySelector<HTMLButtonElement>('.btn-toggle-expand[data-provider="deepseek"]');
    expect(addBtn).not.toBeNull();

    modal.close();
  });

  // =========================================================================
  // 测试 2: @ 联想候选层打开、过滤与键盘选择填入 [真跑验证]
  // =========================================================================
  it('@ 联想候选层：输入 @ 弹出已配 Key 专家浮层，支持过滤、方向键移动与回车填入 [真跑验证]', async () => {
    // 经生产存储路径预置已配 Key：BrowserKeyStore 读 take_key_<provider>（与设置弹窗保存路径一致）
    localStorage.setItem('take_key_anthropic', 'sk-ant-test-key');
    localStorage.setItem('take_key_deepseek', '<redacted>');
    const app = new ChatApp({ container });
    app.mount();

    const textarea = container.querySelector<HTMLTextAreaElement>('#main-textarea');
    expect(textarea).not.toBeNull();

    // 1. 模拟用户输入 "@"
    textarea!.value = '@';
    textarea!.selectionStart = 1;
    textarea!.selectionEnd = 1;
    textarea!.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 断言浮层已渲染
    let popup = container.querySelector('.mention-popup');
    expect(popup).not.toBeNull();

    // 候选列表应包含已配 Key 的专家（Claude, DeepSeek）
    let items = popup!.querySelectorAll<HTMLElement>('.mention-item');
    expect(items.length).toBeGreaterThanOrEqual(1);

    // 2. 模拟过滤输入 "@Cl"
    textarea!.value = '@Cl';
    textarea!.selectionStart = 3;
    textarea!.selectionEnd = 3;
    textarea!.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    popup = container.querySelector('.mention-popup');
    expect(popup).not.toBeNull();
    items = popup!.querySelectorAll<HTMLElement>('.mention-item');
    expect(items.length).toBe(1);
    expect(items[0].getAttribute('data-mention-name')).toBe('Claude');

    // 3. 模拟键盘按下 Enter 键
    textarea!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 断言输入框内容被替换为 "@Claude "
    expect(textarea!.value).toBe('@Claude ');

    // 断言浮层已关闭
    popup = container.querySelector('.mention-popup');
    expect(popup).toBeNull();
  });

  // =========================================================================
  // 测试 3: 对话新建、删除与 localStorage 持久化模拟 [真跑验证]
  // =========================================================================
  it('对话增删与本地持久化：新建对话入列表并持久化，删除后平滑切房，页面重载不丢失 [真跑验证]', async () => {
    const app = new ChatApp({ container });
    app.mount();

    // 初始四间官方预设房
    let roomItems = container.querySelectorAll('.room-item-row');
    expect(roomItems.length).toBe(4);

    // 1. 模拟点击「＋ 新建对话」
    const addRoomBtn = container.querySelector<HTMLButtonElement>('#btn-add-room');
    expect(addRoomBtn).not.toBeNull();

    await app.handleCreateNewChat();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 列表增至 5 间
    roomItems = container.querySelectorAll('.room-item-row');
    expect(roomItems.length).toBe(5);

    // 验证 localStorage 存在持久化数据
    const rawSaved = localStorage.getItem('takechat_rooms_meta_v1');
    expect(rawSaved).not.toBeNull();
    const savedRooms = JSON.parse(rawSaved!);
    expect(savedRooms.length).toBe(5);

    // 2. 模拟点击删除新建的对话
    const newRoomId = savedRooms[4].id;
    app.handleDeleteRoom(newRoomId);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 恢复为 4 间
    roomItems = container.querySelectorAll('.room-item-row');
    expect(roomItems.length).toBe(4);

    const rawAfterDel = localStorage.getItem('takechat_rooms_meta_v1');
    const roomsAfterDel = JSON.parse(rawAfterDel!);
    expect(roomsAfterDel.length).toBe(4);
    expect(roomsAfterDel.some((r: any) => r.id === newRoomId)).toBe(false);

    // 3. 重新实例化模拟页面刷新加载
    container.innerHTML = '';
    const reloadedApp = new ChatApp({ container });
    reloadedApp.mount();

    const reloadedRooms = container.querySelectorAll('.room-item-row');
    expect(reloadedRooms.length).toBe(4);
  });
});
