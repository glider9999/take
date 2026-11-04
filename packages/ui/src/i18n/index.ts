/**
 * @take/ui - i18n/index.ts (工单 10 v4 样张 B 三栏与三页签适配版)
 * 中英双语国际化字典：覆盖全界面文案、三栏重排、三页签设置区、本地工具与会诊进度
 */

export type Locale = 'zh-CN' | 'en-US';

export interface TranslationDict {
  brandTitle: string;
  roomsTitle: string;
  contactsTitle: string;
  cloudAgentsTitle: string;
  localToolsTitle: string;
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
  membersTitle: string;
  stepPrompt: string;
  stepWorkflow: string;
  stepStoryboard: string;
  stepSummary: string;
  stepPromptClaude: string;
  stepWorkflowGrok: string;
  stepStoryboardChatgpt: string;
  stepCodeDeepseek: string;
  stepHostSummary: string;
  inProgress: string;
  waitYou: string;
  ledgerTitle: string;
  ledgerTip: string;
  ledgerSession: string;
  ledgerMonthly: string;
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
  tabProviders: string;
  tabLocalTools: string;
  tabLedger: string;
  statusSpoke: string;
  statusReady: string;
  statusThinking: string;
  statusNoKey: string;
  comfyEndpointLabel: string;
  comfyEndpointDesc: string;
  comfySubmitWorkflow: string;
  comfyClinicSheet: string;
  sessionLimitLabel: string;
  monthlyLimitLabel: string;
}

export const DICTIONARIES: Record<Locale, TranslationDict> = {
  'zh-CN': {
    brandTitle: 'TakeChat',
    roomsTitle: '房间',
    contactsTitle: '联系人',
    cloudAgentsTitle: '云端助手',
    localToolsTitle: '本地工具',
    addContact: '添加联系人',
    addRoom: '＋ 新建房间',
    promptClinic: '提示词会诊',
    generalClinic: '通用会诊室',
    comfyFix: 'ComfyUI 报错会诊',
    broadcastOn: '会诊模式 · 开',
    broadcastOff: '单聊模式 · 关',
    modeTagBroadcast: '提示词会诊 · 主持人协调',
    modeTagMention: '单聊模式 · @定向点名',
    inputPlaceholder: '发消息，或 @ 某位助手接力…',
    sendBtn: '发送',
    sendingBtn: '思考中…',
    progressTitle: '本次会诊进度',
    membersTitle: '成员状态',
    stepPrompt: '写提示词 · Claude',
    stepWorkflow: '搭工作流 · Grok Bot',
    stepStoryboard: '出分镜图 · ChatGPT',
    stepSummary: '汇总拍板 · 等你',
    stepPromptClaude: '提示词 · Claude',
    stepWorkflowGrok: '工作流 · Grok Bot',
    stepStoryboardChatgpt: '分镜图 · ChatGPT',
    stepCodeDeepseek: '参数代码 · DeepSeek',
    stepHostSummary: '主持人汇总',
    inProgress: '进行中',
    waitYou: '等你',
    ledgerTitle: '本地用量账本',
    ledgerTip: '每个专家只答一次；账本只存本机，逼近警戒线只提醒、不锁死。',
    ledgerSession: '本次',
    ledgerMonthly: '本月',
    settings: '⚙ 设置',
    hostSummaryTitle: '主持人汇总：',
    btnApprove: '就按这个开拍',
    btnRetry: '分镜再改一版',
    you: '你',
    testConn: '测试连接',
    testingConn: '测试中…',
    connSuccess: '已连接',
    connFailed: '连接失败',
    connRateLimited: '触发 429 速率限制',
    browserKeyWarning: 'Key 只存于本浏览器本地存储，请勿在公共或他人设备上使用',
    saveConfig: '保存配置',
    needsDesktop: '需本地版',
    needsDesktopNotice: '此功能依赖本地进程或本机私有网络服务，请在 TakeChat 桌面端运行。',
    tabProviders: '厂商与 Key',
    tabLocalTools: '本地工具',
    tabLedger: '账本与警戒线',
    statusSpoke: '已发言',
    statusReady: '待命',
    statusThinking: '思考中',
    statusNoKey: '未配置',
    comfyEndpointLabel: 'ComfyUI 本地生图引擎',
    comfyEndpointDesc: '(用于报错会诊与工作流执行)',
    comfySubmitWorkflow: '提交工作流 JSON',
    comfyClinicSheet: 'ComfyUI 节点报错会诊单',
    sessionLimitLabel: '单次会话警戒线 ($)',
    monthlyLimitLabel: '单月用量警戒线 ($)',
  },
  'en-US': {
    brandTitle: 'TakeChat',
    roomsTitle: 'ROOMS',
    contactsTitle: 'CONTACTS',
    cloudAgentsTitle: 'CLOUD AGENTS',
    localToolsTitle: 'LOCAL TOOLS',
    addContact: 'Add Contact',
    addRoom: '+ New Room',
    promptClinic: 'Prompt Clinic',
    generalClinic: 'General Clinic',
    comfyFix: 'ComfyUI Repair',
    broadcastOn: 'Group Mode: ON',
    broadcastOff: 'Direct Mode: OFF',
    modeTagBroadcast: 'Prompt Clinic · Host Moderation',
    modeTagMention: 'Direct Mode · @Mention',
    inputPlaceholder: 'Send a message, or @ an agent directly…',
    sendBtn: 'Send',
    sendingBtn: 'Thinking…',
    progressTitle: 'SESSION PROGRESS',
    membersTitle: 'MEMBER STATUS',
    stepPrompt: 'Prompts · Claude',
    stepWorkflow: 'Workflow · Grok Bot',
    stepStoryboard: 'Storyboards · ChatGPT',
    stepSummary: 'Decision · Waiting for You',
    stepPromptClaude: 'Prompts · Claude',
    stepWorkflowGrok: 'Workflow · Grok Bot',
    stepStoryboardChatgpt: 'Storyboards · ChatGPT',
    stepCodeDeepseek: 'Parameters & Code · DeepSeek',
    stepHostSummary: 'Host Summary',
    inProgress: 'In Progress',
    waitYou: 'Waiting',
    ledgerTitle: 'LOCAL TOKEN LEDGER',
    ledgerTip: 'Each agent responds once per turn. Stored locally only; warnings alert without locking.',
    ledgerSession: 'Session',
    ledgerMonthly: 'Monthly',
    settings: '⚙ Settings',
    hostSummaryTitle: 'Host Summary:',
    btnApprove: 'Approve & Produce',
    btnRetry: 'Revise Storyboard',
    you: 'You',
    testConn: 'Test Connection',
    testingConn: 'Testing…',
    connSuccess: 'Connected',
    connFailed: 'Connection Failed',
    connRateLimited: 'Rate Limit Exceeded',
    browserKeyWarning: 'API Keys are stored exclusively in your local browser storage. Do not use on public or shared devices.',
    saveConfig: 'Save Settings',
    needsDesktop: 'Desktop Only',
    needsDesktopNotice: 'This feature requires local process or private network access. Please run in TakeChat Desktop edition.',
    tabProviders: 'Providers & Keys',
    tabLocalTools: 'Local Tools',
    tabLedger: 'Ledger & Limits',
    statusSpoke: 'Responded',
    statusReady: 'Ready',
    statusThinking: 'Thinking',
    statusNoKey: 'Not Configured',
    comfyEndpointLabel: 'ComfyUI Local Engine',
    comfyEndpointDesc: '(For error consultation & workflow execution)',
    comfySubmitWorkflow: 'Submit Workflow JSON',
    comfyClinicSheet: 'ComfyUI Node Error Case Sheet',
    sessionLimitLabel: 'Session Alert Limit ($)',
    monthlyLimitLabel: 'Monthly Alert Limit ($)',
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
