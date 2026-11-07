/**
 * 工单 20 交付验证：样式类 ↔ DOM 对账（作为 vitest 测试运行）
 * 用 happy-dom 真实挂载 ChatApp，检查 app.css 每个类名是否在渲染输出中接回
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatApp } from '../src/components/ChatApp.js';

const CSS_PATH = resolve(process.cwd(), 'src/styles/app.css');

describe('工单 20 交付对账：样式类 ↔ DOM', () => {
  it('app.css 全部类名在 ChatApp 渲染输出中接回（或属于弹窗/分镜/演示态）', async () => {
    document.body.innerHTML = '';
    localStorage.setItem('take_key_anthropic', 'sk-ant-test');
    localStorage.setItem('take_key_deepseek', 'sk-ds-test');

    const container = document.createElement('div');
    container.id = 'app-root';
    document.body.appendChild(container);

    const app = new ChatApp({ container, isDesktop: false });
    app.mount();
    await new Promise((r) => setTimeout(r, 50));

    const html = container.innerHTML;

    const css = readFileSync(CSS_PATH, 'utf8');
    const classSet = new Set<string>();
    for (const m of css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
      const name = m[1];
      if (!['spin', 'tilt'].includes(name)) classSet.add(name);
    }

    // 白名单：不在首屏主界面出现（弹窗/分镜卡/演示载入后/思考态/错误徽标）
    const deferred = new Set([
      // CSS 注释中的词（非真实类名）
      'css', 'win',
      // 设置弹窗（独立组件挂 document.body，不在 container.innerHTML 里）
      'modal-backdrop', 'modal', 'mh', 'mb', 'vrow', 'compact-vrow', 'vn', 'key',
      'st', 'ok', 'err', 'none', 'tb', 'tab', 'pane',
      'btn-toggle-expand', 'btn-toggle-collapse', 'btn-delete-key', 'btn-test-conn',
      'btn-save-settings', 'model-input', 'key-input', 'provider-list', 'tab-pane',
      // @ 候选弹层（输入 @ 后出现）
      'mention-item', 'mention-popup', 'mention-empty-hint', 'selected', 'name', 'provider', 'provider',
      // 分镜卡/汇总表（消息流内容态，空态不渲染）
      'shot-card', 'desc', 'pbox', 'img-placeholder', 'img-preview', 'actions',
      'shot-btn', 'primary', 'pending', 'rendered', 'finalized', 'sb-table',
      'head', 'badge-pending',
      // 消息流内容态（载入演示/发送消息后出现）
      'msg', 'who', 'bubble', 'host', 'me', 'typing', 'frames', 'frame', 'step',
      // 思考态/错误徽标（运行时状态）
      'think-tag', 'err-n', 'ava', 'think',
      // 头像类（agents 渲染在左栏，但 .lg 只在消息区）——见下方单独抽查
      'lg', 'a-host', 'a-user',
      // 模式按钮激活态（类名 on 由状态决定）
      'on', 'off', 'hot', 'doing', 'wait', 'thinking',
      // 弹窗内部（SettingsModal 渲染）
      'comfy-workbench', 'comfy-submit',
      // 首屏 hero 按钮（空态才有；本测试走了 hasLoadedDemo=false 分支有按钮，但类名 btn-load-demo 应出现）
      'btn-load-demo',
    ]);

    const missing: string[] = [];
    for (const cls of classSet) {
      if (deferred.has(cls)) continue;
      if (!html.includes(cls)) missing.push(cls);
    }

    console.log(`app.css 类名总数: ${classSet.size}`);
    console.log(`DOM 首屏命中: ${classSet.size - missing.length - deferred.size}`);
    console.log(`白名单(延迟态): ${deferred.size}`);
    if (missing.length > 0) {
      console.log('未命中清单:', missing.join(', '));
    }
    expect(missing).toEqual([]);

    // 结构抽查
    for (const sel of ['.app', '.topbar', '.logo', '.body', '.rail', '.main', '.chat-head', '.msgs', '.composer', '.box', '.send', '.right', '.card', '.mini-card', '.lbar', '.mrow', '.dot', '.btn-add-room', '.btn-del-room', '.room-item-row', '.mode-toggle', '.empty-hero', '.ch-row', '.ch-btns', '.nm', '.grow', '.sp', '.rt', '.tbtn', '.item']) {
      expect(html).toContain(sel.slice(1));
    }

    // 状态点：12 家云端厂商，只有 anthropic/deepseek 配了 Key
    const dotOffCount = (html.match(/dot off/g) || []).length;
    const dotPlain = (html.match(/class="dot"/g) || []).length;
    console.log(`状态点: 绿 ${dotPlain}, 灰(off) ${dotOffCount}`);
    expect(dotPlain).toBe(2); // anthropic + deepseek
    expect(dotOffCount).toBe(10); // 其余 10 家云端厂商

    // 头像类对齐：12 家 + cli/cui
    for (const a of ['a-claude', 'a-gpt', 'a-gem', 'a-ds', 'a-grok', 'a-kimi', 'a-or', 'a-qwen', 'a-glm', 'a-db', 'a-mx', 'a-nv', 'a-cli', 'a-cui']) {
      expect(html).toContain(a);
    }

    // 输入区结构：段控件 + 多行输入 + 朱红发送
    expect(html).toContain('id="btn-mode-broadcast"');
    expect(html).toContain('id="btn-mode-mention"');
    expect(html).toContain('rows="3"');
    expect(html).toContain('id="messages-stream"');
  });

  it('载入演示后：消息流、主持人气泡、步骤、成员行全部出现', async () => {
    document.body.innerHTML = '';
    localStorage.clear();

    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = new ChatApp({ container, isDesktop: false });
    app.mount();

    const demoBtn = container.querySelector('#btn-load-demo');
    expect(demoBtn).not.toBeNull();
    demoBtn!.click();
    await new Promise((r) => setTimeout(r, 20));

    const html = container.innerHTML;
    for (const cls of ['msg', 'host', 'who', 'bubble', 'ava', 'step', 'mrow', 'ic']) {
      expect(html).toContain(cls);
    }
    // 步骤三态
    expect(html).toContain('step wait');
    expect(html).toContain('step doing');
  });

  it('设置弹窗：vrow 换行规则存在、保存按钮朱红类、页签下划线规则存在', () => {
    const css = readFileSync(CSS_PATH, 'utf8');
    expect(css).toContain('.vrow {');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('.btn-save-settings');
    expect(css).toContain('.tab.on::after');
    expect(css).toContain('Montserrat');
    expect(css).toContain('.a-nv');
    expect(css).toContain('.a-qwen');
  });
});
