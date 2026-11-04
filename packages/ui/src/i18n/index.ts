/**
 * @take/ui - i18n/index.ts (工单 13 抛光补丁单双语终版)
 * 中英双语国际化字典：界面模板所有标签/状态/徽章/占位/提示彻底清零写死中文
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
  modeAllReply: string;
  modeMentionOne: string;
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
  hostLabel: string;
  presentSuffix: string;
  badgeNew: string;
  testConn: string;
  testingConn: string;
  connSuccess: string;
  connFailed: string;
  connRateLimited: string;
  browserKeyWarning: string;
  desktopVaultLabel: string;
  browserStorageLabel: string;
  alertPrefix: string;
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
  statusRegistered: string;
  statusUntested: string;
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
  rightRailProgressEmpty: string;
  rightRailMembersEmpty: string;
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
    broadcastOn: '全员会诊',
    broadcastOff: '点名某人',
    modeTagBroadcast: '全员会诊（在场模型各答一次）',
    modeTagMention: '点名某人（仅点名者回复）',
    modeAllReply: '全员会诊',
    modeMentionOne: '点名某人',
    inputPlaceholder: '发消息（在场模型各答一次），或 @ 某位专家单独问…',
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
    hostLabel: '主持人',
    presentSuffix: '在场',
    badgeNew: '新',
    testConn: '测试连接',
    testingConn: '测试中…',
    connSuccess: '已连接',
    connFailed: '连接失败',
    connRateLimited: '触发 429 速率限制',
    browserKeyWarning: 'Key 只存于本浏览器本地存储，请勿在公共或他人设备上使用',
    desktopVaultLabel: '桌面端钥匙串保护',
    browserStorageLabel: '本地存储警示',
    alertPrefix: '预警',
    saveConfig: '保存配置',
    needsDesktop: '桌面版可用',
    needsDesktopNotice: '此能力在桌面版可用（支持本地进程与私网直连）· 查看安装指引',
    tabProviders: '厂商与 Key',
    tabLocalTools: '本地工具',
    tabLedger: '账本与警戒线',
    statusSpoke: '已发言',
    statusReady: '待命',
    statusThinking: '思考中',
    statusNoKey: '未配置',
    statusRegistered: '已登记',
    statusUntested: '未测试',
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
    rightRailProgressEmpty: '暂无进行中的会诊，载入演示或发送消息后将自动跟踪阶段进度。',
    rightRailMembersEmpty: '专家就绪待命，发送首条消息即可激活在场模型。',
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
    broadcastOn: 'All models reply',
    broadcastOff: 'Mention one',
    modeTagBroadcast: 'All models reply (each once)',
    modeTagMention: 'Mention one (direct reply)',
    modeAllReply: 'All models reply',
    modeMentionOne: 'Mention one',
    inputPlaceholder: 'Type a message (all models will reply once), or @ an agent directly…',
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
    ledgerTitle: 'TOKEN LEDGER',
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
    hostLabel: 'Host',
    presentSuffix: 'present',
    badgeNew: 'NEW',
    testConn: 'Test Connection',
    testingConn: 'Testing…',
    connSuccess: 'Connected',
    connFailed: 'Connection Failed',
    connRateLimited: 'Rate Limit Exceeded',
    browserKeyWarning: 'API Keys are stored exclusively in your local browser storage. Do not use on public or shared devices.',
    desktopVaultLabel: 'Desktop Keychain Vault',
    browserStorageLabel: 'Local Storage Notice',
    alertPrefix: 'Alert',
    saveConfig: 'Save Settings',
    needsDesktop: 'Desktop app',
    needsDesktopNotice: 'Available in Desktop Edition (supports local processes & private network) · View Setup Guide',
    tabProviders: 'Providers & Keys',
    tabLocalTools: 'Local Tools',
    tabLedger: 'Ledger & Limits',
    statusSpoke: 'Responded',
    statusReady: 'Ready',
    statusThinking: 'Thinking',
    statusNoKey: 'Not Configured',
    statusRegistered: 'Registered',
    statusUntested: 'Untested',
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
    rightRailProgressEmpty: 'No active consultation. Load demo or send a message to track progress.',
    rightRailMembersEmpty: 'Agents are on standby. Send your first message to activate.',
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
