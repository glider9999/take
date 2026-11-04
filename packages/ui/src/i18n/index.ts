/**
 * @take/ui - i18n/index.ts (工单 12 双语清零与质感抛光版)
 * 中英双语国际化字典：彻底消除硬编码与中英夹杂，全界面模式切换严格全中文/全英文
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
  storyboardClinic: string;
  broadcastOn: string;
  broadcastOff: string;
  modeTagBroadcast: string;
  modeTagMention: string;
  inputPlaceholder: string;
  sendBtn: string;
  sendingBtn: string;
  progressTitle: string;
  membersTitle: string;
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
  ledgerSummaryLabel: string;
  ledgerViewDetails: string;
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
  comfyEndpointHint: string;
  comfySubmitWorkflow: string;
  comfyClinicSheet: string;
  sessionLimitLabel: string;
  monthlyLimitLabel: string;
  storyboardTableTitle: string;
  shotCardTitle: string;
  shotScaleLabel: string;
  shotPromptLabel: string;
  shotStatusPending: string;
  shotStatusRendered: string;
  shotStatusFinalized: string;
  btnRenderShot: string;
  btnFinalizeShot: string;
  emptyTitle: string;
  emptySubtitle: string;
  btnLoadDemo: string;
  emptyPlaceholder: string;
  addKey: string;
  collapseKey: string;
}

export const DICTIONARIES: Record<Locale, TranslationDict> = {
  'zh-CN': {
    brandTitle: 'TakeChat',
    roomsTitle: '会诊房间',
    contactsTitle: '联系人',
    cloudAgentsTitle: '云端助手',
    localToolsTitle: '本地工具',
    addContact: '添加联系人',
    addRoom: '＋ 新建房间',
    promptClinic: '提示词会诊',
    generalClinic: '通用会诊室',
    comfyFix: 'ComfyUI 报错会诊',
    storyboardClinic: '分镜与镜头会诊',
    broadcastOn: '会诊模式（在场模型各答一次）',
    broadcastOff: '单聊模式（仅点名回复）',
    modeTagBroadcast: '全员会诊 · 主持人协调',
    modeTagMention: '单聊模式 · @定向点名',
    inputPlaceholder: '发消息（在场模型将各答一次），或 @ 某位专家单独问…',
    sendBtn: '发送',
    sendingBtn: '思考中…',
    progressTitle: '本次会诊进度',
    membersTitle: '成员状态',
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
    ledgerSummaryLabel: '本月用量',
    ledgerViewDetails: '查看进度条',
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
    needsDesktop: '需桌面版',
    needsDesktopNotice: '此能力在桌面版可用（支持本地进程与私网直连）· 查看安装指引',
    tabProviders: '厂商与 Key',
    tabLocalTools: '本地工具',
    tabLedger: '账本与警戒线',
    statusSpoke: '已发言',
    statusReady: '待命',
    statusThinking: '思考中',
    statusNoKey: '未配置',
    comfyEndpointLabel: 'ComfyUI 本地生图引擎',
    comfyEndpointDesc: '(用于报错会诊与工作流执行)',
    comfyEndpointHint: '服务默认使用本机端口 8188。点击「测试连接」将探测 /system_stats 确认服务在线与版本。',
    comfySubmitWorkflow: '提交工作流 JSON',
    comfyClinicSheet: 'ComfyUI 节点报错会诊单',
    sessionLimitLabel: '单次会话警戒线 ($)',
    monthlyLimitLabel: '单月用量警戒线 ($)',
    storyboardTableTitle: '分镜整表汇总',
    shotCardTitle: '分镜卡',
    shotScaleLabel: '景别',
    shotPromptLabel: '镜头提示词',
    shotStatusPending: '待定',
    shotStatusRendered: '已出图',
    shotStatusFinalized: '已定稿',
    btnRenderShot: 'ComfyUI 出图',
    btnFinalizeShot: '定稿',
    emptyTitle: '开启多模型协同会诊',
    emptySubtitle: '选择左侧会诊室开启协同讨论，或载入官方《雨夜》短片全流程演示。',
    btnLoadDemo: '🎬 载入演示数据',
    emptyPlaceholder: '直接输入消息即可开启新一轮会诊讨论…',
    addKey: '+ 添加 Key',
    collapseKey: '收起',
  },
  'en-US': {
    brandTitle: 'TakeChat',
    roomsTitle: 'CLINIC ROOMS',
    contactsTitle: 'CONTACTS',
    cloudAgentsTitle: 'CLOUD AGENTS',
    localToolsTitle: 'LOCAL TOOLS',
    addContact: 'Add Contact',
    addRoom: '+ New Room',
    promptClinic: 'Prompt Clinic',
    generalClinic: 'General Clinic',
    comfyFix: 'ComfyUI Repair',
    storyboardClinic: 'Storyboard & Camera Clinic',
    broadcastOn: 'Group Mode (All respond once)',
    broadcastOff: 'Direct Mode (Mention only)',
    modeTagBroadcast: 'Group Consultation · Host Moderated',
    modeTagMention: 'Direct Mode · @Mention Only',
    inputPlaceholder: 'Type a message (all agents will respond once), or @ an agent directly…',
    sendBtn: 'Send',
    sendingBtn: 'Thinking…',
    progressTitle: 'SESSION PROGRESS',
    membersTitle: 'MEMBER STATUS',
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
    ledgerSummaryLabel: 'Monthly Usage',
    ledgerViewDetails: 'View Progress',
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
    needsDesktopNotice: 'Available in Desktop Edition (supports local processes & private network) · View Setup Guide',
    tabProviders: 'Providers & Keys',
    tabLocalTools: 'Local Tools',
    tabLedger: 'Ledger & Limits',
    statusSpoke: 'Responded',
    statusReady: 'Ready',
    statusThinking: 'Thinking',
    statusNoKey: 'Not Configured',
    comfyEndpointLabel: 'ComfyUI Local Engine',
    comfyEndpointDesc: '(For error consultation & workflow execution)',
    comfyEndpointHint: 'The service defaults to local port 8188. Click "Test Connection" to probe /system_stats for status and version.',
    comfySubmitWorkflow: 'Submit Workflow JSON',
    comfyClinicSheet: 'ComfyUI Node Error Case Sheet',
    sessionLimitLabel: 'Session Alert Limit ($)',
    monthlyLimitLabel: 'Monthly Alert Limit ($)',
    storyboardTableTitle: 'Storyboard Table Summary',
    shotCardTitle: 'Shot Card',
    shotScaleLabel: 'Scale',
    shotPromptLabel: 'Camera Prompt',
    shotStatusPending: 'Pending',
    shotStatusRendered: 'Rendered',
    shotStatusFinalized: 'Finalized',
    btnRenderShot: 'Render with ComfyUI',
    btnFinalizeShot: 'Finalize',
    emptyTitle: 'Start Multi-Agent Consultation',
    emptySubtitle: 'Select a clinic from the left rail, or load the official "Rainy Night" demo session.',
    btnLoadDemo: '🎬 Load Demo Session',
    emptyPlaceholder: 'Type a message to start a new consultation session…',
    addKey: '+ Add Key',
    collapseKey: 'Collapse',
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
