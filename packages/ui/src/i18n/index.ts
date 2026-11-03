/**
 * @take/ui - i18n/index.ts
 * 中英双语国际化字典与语言切换系统（默认跟随系统 navigator.language）
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
  },
};

let currentLocale: Locale = 'zh-CN';

// 初始化根据浏览器语言自动侦测
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

