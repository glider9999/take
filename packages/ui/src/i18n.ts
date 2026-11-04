/**
 * @take/ui - i18n/index.ts (工单 08 扩充版)
 * 增加「需本地版」降级提示与本地 CLI 运行环境文案
 */

export type Locale = 'zh-CN' | 'en-US';

export interface TranslationDict {
  brandTitle: string;
  roomsTitle: string;
  contactsTitle: string;
  addContact: string;
  addRoom: string;
  promptClinic: string;
  generalClinic: string;
  comfyFix: string;
  broadcastOn: string;
  broadcastOff: string;
  modeTagBroadcast: string;
  modeTagMention: string;
  inputPlaceholder: string;
  sendBtn: string;
  sendingBtn: string;
  progressTitle: string;
  stepPrompt: string;
  stepWorkflow: string;
  stepStoryboard: string;
  stepSummary: string;
  inProgress: string;
  waitYou: string;
  ledgerTitle: string;
  ledgerTip: string;
  settings: string;
  hostSummaryTitle: string;
  btnApprove: string;
  btnRetry: string;
  you: string;
  testConn: string;
  testingConn: string;
  connSuccess: string;
  connFailed: string;
  connRateLimited: string;
  browserKeyWarning: string;
  saveConfig: string;
  needsDesktop: string;
  needsDesktopNotice: string;
}

export const DICTIONARIES: Record<Locale, TranslationDict> = {
  'zh-CN': {
    brandTitle: 'TakeChat',
    roomsTitle: '房 间',
    contactsTitle: '联 系 人',
    addContact: '添加联系人',
    addRoom: '＋ 新建房间',
    promptClinic: '提示词会诊',
    generalClinic: '通用会诊室',
    comfyFix: 'ComfyUI 报错会诊',
    broadcastOn: '会诊模式 · 开',
    broadcastOff: '单聊模式 · 关',
    modeTagBroadcast: '会诊模式 · 全员接力',
    modeTagMention: '单聊模式 · @定向点名',
    inputPlaceholder: '发一句话，或 @ 一位专家单独问…',
    sendBtn: '发送',
    sendingBtn: '思考中…',
    progressTitle: '本 次 会 诊 进 度',
    stepPrompt: '写提示词 · Claude',
    stepWorkflow: '搭工作流 · Grok Bot',
    stepStoryboard: '出分镜图 · ChatGPT',
    stepSummary: '汇总拍板 · 等你',
    inProgress: '进行中',
    waitYou: '等你',
    ledgerTitle: '本 地 用 量 账 本',
    ledgerTip: '每个专家只答一次；账本只存本机，逼近警戒线只提醒、不锁死。',
    settings: '⚙ 设置',
    hostSummaryTitle: '主持人汇总：',
    btnApprove: '就按这个开拍',
    btnRetry: '分镜再改一版',
    you: '你',
    testConn: '测试连接',
    testingConn: '测试中…',
    connSuccess: '连通成功',
    connFailed: '连接失败',
    connRateLimited: '触发 429 速率限制',
    browserKeyWarning: 'Key 只存于本浏览器本地存储，请勿在公共或他人设备上使用',
    saveConfig: '保存配置',
    needsDesktop: '需本地版',
    needsDesktopNotice: '本地 CLI 智能体需要运行 TakeChat 桌面完全版才能拉起本机进程，浏览器沙箱环境不支持本地命令。',
  },
  'en-US': {
    brandTitle: 'TakeChat',
    roomsTitle: 'ROOMS',
    contactsTitle: 'CONTACTS',
    addContact: 'Add Contact',
    addRoom: '+ New Room',
    promptClinic: 'Prompt Clinic',
    generalClinic: 'General Clinic',
    comfyFix: 'ComfyUI Repair',
    broadcastOn: 'Group Mode: ON',
    broadcastOff: 'Direct Mode: OFF',
    modeTagBroadcast: 'Group Mode · Cooperative Relay',
    modeTagMention: 'Direct Mode · @Mention',
    inputPlaceholder: 'Say something, or @ an agent directly…',
    sendBtn: 'Send',
    sendingBtn: 'Thinking…',
    progressTitle: 'SESSION PROGRESS',
    stepPrompt: 'Prompts · Claude',
    stepWorkflow: 'Workflow · Grok Bot',
    stepStoryboard: 'Storyboards · ChatGPT',
    stepSummary: 'Decision · Waiting for You',
    inProgress: 'In Progress',
    waitYou: 'Waiting',
    ledgerTitle: 'LOCAL TOKEN LEDGER',
    ledgerTip: 'Each agent responds once per turn. Stored locally only; warnings alert without locking.',
    settings: '⚙ Settings',
    hostSummaryTitle: 'Host Summary:',
    btnApprove: 'Approve & Produce',
    btnRetry: 'Revise Storyboard',
    you: 'You',
    testConn: 'Test Connection',
    testingConn: 'Testing…',
    connSuccess: 'Connected Successfully',
    connFailed: 'Connection Failed',
    connRateLimited: 'Rate Limit Exceeded',
    browserKeyWarning: 'API Keys are stored exclusively in your local browser storage. Do not use on public or shared devices.',
    saveConfig: 'Save Settings',
    needsDesktop: 'Desktop Only',
    needsDesktopNotice: 'Local CLI agents require the TakeChat Desktop native edition to spawn local processes. Browser sandbox environments cannot execute local commands.',
  },
};

let currentLocale: Locale = 'zh-CN';

if (typeof navigator !== 'undefined' && navigator.language) {
  if (navigator.language.toLowerCase().startsWith('en')) {
    currentLocale = 'en-US';
  } else {
    currentLocale = 'zh-CN';
  }
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: keyof TranslationDict): string {
  return DICTIONARIES[currentLocale][key] || DICTIONARIES['zh-CN'][key] || key;
}
