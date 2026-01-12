
// ... (Existing Enums)

export enum ChannelType {
  STORY = 'قصصي',
  INFO = 'معلوماتي',
  NEWS = 'إخباري'
}

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NEEDS_APPROVAL = 'NEEDS_APPROVAL',
  SKIPPED = 'SKIPPED'
}

export enum AgentRole {
  ANALYST_AGENT = 'AnalystAgent',
  ADMIN_PLANNER = 'AdminPlanner', 
  STRATEGY_DIRECTOR = 'StrategyDirector',
  HOOK_MAKER = 'HookMaker', 
  TITLE_OPTIMIZER = 'TitleGenerator',
  TITLE_SELECTOR = 'TitleSelector',
  STRUCTURE_AGENT = 'StructureAgent',
  SCRIPT_BUILDER = 'ScriptBuilder',
  MICRO_SCRIPT_BUILDER = 'MicroScriptBuilder', 
  PACING_REVIEWER = 'PacingReviewer',
  SCENE_PLANNER = 'ScenePlanner',
  VISUAL_PRODUCER = 'VisualProducer',
  VOICE_DIRECTOR = 'VoiceDirector',
  MUSIC_DIRECTOR = 'MusicDirector', 
  EDITOR_ASSEMBLER = 'EditorAssembler',
  QA_REVIEWER = 'QAReviewer',
  RISK_AGENT = 'RiskAgent',
  SCHEDULER_AGENT = 'SchedulerAgent',
  PUBLISHER = 'Publisher',
  THUMBNAIL_MAKER = 'ThumbnailMaker',
  BUILDER_EXECUTOR = 'BuilderExecutor',
  FIXER_EXECUTOR = 'FixerExecutor',
  PRODUCER_EXECUTOR = 'ProducerExecutor'
}

// ... (KPI Types)

export interface AgentMetrics {
    role: AgentRole;
    avgExecutionTime: number; 
    maxExecutionTime: number; 
    successCount: number;
    failureCount: number;
    failureRate: number; 
    qualityScore: number; 
    humanInterventionCount: number;
    status: 'ACTIVE' | 'DEGRADED' | 'SUSPENDED';
    lastUpdated: string;
}

export interface ProductionLineMetrics {
    lineType: string;
    videosPerDay: number;
    avgTimePerVideo: number;
    failureRate: number;
    publishSuccessRate: number;
    idleTimePercentage: number;
    lastActive: string;
}

export interface SystemHealthReport {
    status: 'GREEN' | 'YELLOW' | 'RED';
    activeAlerts: string[];
    generatedAt: string;
}

export enum ProviderType {
  LLM = 'LLM',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  VOICE = 'VOICE',
  MUSIC = 'MUSIC',
  ANALYTICS = 'ANALYTICS',
  PUBLISHING = 'PUBLISHING'
}

export type ProductionType = 'Long' | 'Shorts';
export type ProductionLine = 'Long Narrative' | 'Long Explainer' | 'Shorts';
export type AdminScope = 'Production' | 'Analytics' | 'Automation' | 'UI' | 'DevOps';

export interface RuntimeSnapshot {
    id: string;
    label: string;
    timestamp: string;
    filesCount: number;
}

export interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface FileSystemOp {
    path: string;
    content?: string;
    type: 'write' | 'read' | 'delete';
}

export interface AdminMessage {
    id: string;
    role: 'user' | 'admin' | 'system';
    content: string;
    timestamp: string;
    relatedPlanId?: string;
    relatedTicketId?: string;
}

export interface AdminPlan {
    id: string;
    title: string;
    status: 'PROPOSED' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
    steps: AdminStep[];
    executor: AgentRole;
    snapshotId?: string;
    ticketId?: string;
}

export interface AdminStep {
    id: string;
    description: string;
    command: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    logs: string[];
}

export enum TicketPriority {
    A = 'A', B = 'B', C = 'C', D = 'D'
}

export enum TicketStatus {
    PROPOSED = 'PROPOSED', APPROVED = 'APPROVED', IN_PROGRESS = 'IN_PROGRESS', TESTED = 'TESTED', RELEASED = 'RELEASED', REJECTED = 'REJECTED'
}

export interface DevelopmentReport {
    gap: string; impact: string; proposal: string; scope: string[]; risk: string; rollback: string; metric_current: string; metric_expected: string; priority: TicketPriority;
}

export interface DevelopmentTicket extends DevelopmentReport {
    id: string; status: TicketStatus; createdAt: string; owner: string;
}

export interface ProviderConfig {
  id: string; name: string; type: ProviderType; providerId: string; apiKey?: string; isEnabled: boolean; status: 'operational' | 'error' | 'untested'; lastTestedAt?: string; models?: string[];
}

export interface AgentConfiguration {
  agentRole: AgentRole; providerId: string; modelId: string; customSystemInstruction?: string; temperature?: number;
}

export interface VoicePreset {
  id: string; name: string; providerId: string; nativeVoiceId: string; gender: 'Male' | 'Female'; style: string; languageCode: string; sampleUrl?: string;
}

export interface MusicTrack {
  id: string; title: string; url: string; tags: string[]; bpm?: number; mood?: string; genre?: string; length_seconds?: number; has_vocals?: boolean;
}

export interface YouTubeLinkedChannel {
  youtubeChannelId: string; title: string; thumbnailUrl: string; linkedAt: string; refreshToken?: string;
}

export interface Channel {
  id: string; name: string; language: string; tone: string; visualStyle: string; youtubeId?: string; linkedYouTubeChannel?: YouTubeLinkedChannel; status: 'active' | 'paused'; defaultVoiceId?: string; defaultProviderConfig?: Record<ProviderType, string>; createdAt: string; niche?: string; audienceDescription?: string;
}

export interface AgentStandardInput {
  taskId: string; role: AgentRole; objective: string; inputData: any; constraints?: string[]; context?: any; meta: { fromAdminDirector: boolean; timestamp: string; priority: 'Normal' | 'High' | 'Critical'; };
}

export interface AgentStandardResponse {
  status: 'SUCCESS' | 'FAILURE' | 'RETRY_NEEDED'; output: any; notes: string[]; warnings: string[]; usage?: { prompt: number; candidates: number; total: number };
}

export interface DecisionLogEntry {
  timestamp: string; phase: string; request: string; decision: string; reasoning: string; rejectedAlternatives?: string[];
}

export interface AdminTask {
    id: string; title: string; targetSystem: 'Server' | 'DB' | 'Agent'; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; result?: string; logs: string[];
}

export interface AdminJob {
    id: string; brief: string; scopes: AdminScope[]; priority: 'Normal' | 'High'; status: 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'; executionPlan: AdminTask[]; decisionsLog: string[]; structuredDecisions: DecisionLogEntry[]; finalOutput?: any; createdAt: string;
}

export interface AutomationAgentConfig {
  analyst: 'auto' | 'skip'; strategy: 'auto' | 'manual' | 'skip'; script: 'auto' | 'manual' | 'skip'; visuals: 'auto' | 'manual' | 'skip'; voice: 'auto' | 'manual' | 'skip'; music: 'auto' | 'off' | 'manual';
}

export interface AutomationVideoSpecs {
  durationUnit: 'seconds' | 'minutes'; targetDuration: number; videosPerDay: number;
}

export interface AutomationVisualConfig {
  provider: 'nano_banana' | 'veo_3_1_fast' | 'veo_2' | 'imagen_3'; mode: 'images' | 'video' | 'mixed'; fallbackProvider?: string; imageQuantityMode: 'auto' | 'custom'; imageQuantity?: number; enableTextOverlay: boolean; textOverlayStyle?: 'cinematic' | 'subtitles' | 'minimal' | 'bold';
}

export interface AutomationVoiceSettings {
  mode: 'auto_match_channel' | 'specific_preset'; voicePresetId?: string; speed: number;
}

export interface AutomationScheduleConfig {
  timezone: string; times: string[]; days: string[]; startDate: string; useAdminPlanner: boolean;
}

export interface AutomationPublishConfig {
    mode: 'Draft' | 'Private' | 'Scheduled' | 'Public'; enableMonetization: boolean; markAsAI: boolean; autoScheduleOffsetHours?: number;
}

export interface AutomationConfig {
  id: string; name: string; channelId: string; pipelineLine: ProductionLine; isEnabled: boolean; agents: AutomationAgentConfig; specs: AutomationVideoSpecs; visuals: AutomationVisualConfig; voiceSettings: AutomationVoiceSettings; schedule: AutomationScheduleConfig; publishing: AutomationPublishConfig; lastRunAt?: string; videosPerDay?: number; scheduleTimes?: string[]; planningMode?: 'Manual' | 'Agent'; publishMode?: string;
}

// NEW: Campaign Interface
export interface Campaign {
    id: string;
    name: string;
    channelId: string;
    pipelineType: ProductionLine;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    config: {
        videosPerDay: number;
        creationTime: string; // HH:MM (Server time to start generation)
        publishTimes: string[]; // Array of HH:MM
        publishMode: 'Draft' | 'Private' | 'Scheduled' | 'Public';
        recurrence: 'Daily' | 'Once';
    };
    topicManager: {
        mode: 'List' | 'AI_Auto';
        pendingTopics: string[]; // List of future topics
        completedTopics: string[]; // History to avoid duplication
    };
    createdAt: string;
    lastRun?: string;
}

export interface AutomationRule {
  id: string; channelId: string; frequency: string; videosPerRun: number; videoType: ChannelType; publishMode: string; createdAt: string;
}

export interface PlannedItem {
  time: string; topic: string; title: string; angle: string; duration: number; visual_provider: string;
}

export interface DailyPlan {
  id: string; automationId: string; date: string; timezone: string; target_channel_id: string; items: PlannedItem[]; generatedAt: string;
}

export interface ProductionRun {
  id: string; channelId: string; name: string; triggerType: 'Schedule' | 'Manual' | 'Automation'; automationId?: string; createdAt: string; status: JobStatus; progress: number;
}

export interface DurationConfig {
  mode: 'fixed' | 'range'; unit: 'minutes' | 'seconds'; target_value: number; min_value?: number; max_value?: number; target_minutes?: number; min_minutes?: number; max_minutes?: number;
}

export interface TextOverlayConfig {
    enabled: boolean;
    style: 'Cinematic' | 'Standard' | 'Bold';
    lines: 1 | 2 | 3;
    size: 'Small' | 'Medium' | 'Large';
}

export interface VisualConfig {
  mode: 'images' | 'video' | 'mixed'; 
  provider: 'nano_banana' | 'veo_3_1_fast' | 'veo_2'; 
  providerModel?: string; 
  fallback: 'images' | 'veo_2'; 
  quality: 'standard' | 'high'; 
  aspectRatio: '16:9' | '9:16';
  textOverlay?: TextOverlayConfig;
}

export interface StepControl {
  title: 'manual' | 'agent'; script: 'manual' | 'agent'; scenes: 'manual' | 'agent'; visuals: 'agent'; voice: 'agent'; music: 'auto' | 'off' | 'manual'; publish: 'manual' | 'auto';
}

export interface ManualInputs {
  title?: string; script?: string; scenePlanJSON?: string; sourceMaterial?: string;
}

export interface ProductionJob {
  id: string;
  runId: string;
  title: string;
  type: ProductionType; 
  currentStepIndex: number;
  status: JobStatus;
  steps: ProductionStep[];
  artifacts: Record<string, any>; 
  logs: LogEntry[];
  durationConfig?: DurationConfig; 
  visualConfig?: VisualConfig;
  stepControl?: StepControl;
  manualInputs?: ManualInputs;
  publishingConfig?: AutomationPublishConfig;
  totalCost?: number;
  totalTokens?: number;
  createdAt: string;
  progress?: number;
  // New UI specific fields
  channelId?: string;
  videoType?: string; // Story, Info, etc.
  llmModel?: string;
  musicMode?: 'Off' | 'Auto Mix';
  voiceMode?: 'Agent' | 'Auto';
  triggerType?: string;
}

export interface ProductionStep {
  id: string;
  agentRole: AgentRole;
  name: string;
  status: JobStatus;
  retryCount: number;
  errorMessage?: string;
  outputSummary?: string;
  tokenUsage?: { prompt: number; candidates: number; total: number };
  cost?: number; 
  artifacts?: { label: string; type: 'json' | 'image' | 'video' | 'audio' | 'text' | 'mix_config'; url?: string; content?: string }[];
}

export interface LogEntry {
  timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; agent: AgentRole; message: string; metadata?: any;
}

// ... (Rest of interfaces)
export interface Scene { id: string; text: string; visualPrompt: string; imageUrl?: string; audioUrl?: string; duration?: number; }
export interface VideoScript { title: string; hook: string; angle: string; scenes: Scene[]; }
export interface AgentResult { ok: boolean; outputs: any; artifacts?: { type: string; data: any; label: string }[]; errorMessage?: string; usage?: { prompt: number; candidates: number; total: number }; }
export interface AnalystResult { analysis_summary: string; identified_trends: string[]; performance_verdict: string; suggested_topics: { topic: string; reasoning: string; predicted_performance: string; }[]; }
export interface AdminPlannerResult { date: string; timezone: string; target_channel_id: string; items: PlannedItem[]; }
export interface StrategyResult { idea: string; angle: string; hooks: string[]; promise: string; outline: string[]; }
export interface Chapter { title: string; objective: string; duration_seconds: number; break_points: string[]; }
export interface StructureResult { chapters: Chapter[]; }
export interface ScriptResult { script_final: string; chapters_content: { title: string; content: string }[]; }
export interface PacingResult { refined_script: string; notes: string[]; improvements: string; }
export interface TitleVariant { text: string; type: 'Curiosity' | 'Emotional' | 'Direct' | 'Informational'; }
export interface TitleResult { titles: TitleVariant[]; }
export interface TitleSelectionResult { selected_title: string; backup_title: string; reasoning: string; }
export interface SceneDefinition { scene_id: string; duration_seconds: number; objective: string; visual_prompt: string; mood: string; shot_type: string; narration_text?: string; generatedImageUrl?: string; generatedVideoUrl?: string; generatedAudioUrl?: string; generatedAudioBlob?: Blob; generatedVideoBlob?: Blob; mediaType?: 'image' | 'video'; }
export interface ScenePlanResult { scenes: SceneDefinition[]; }
export interface MusicDirectorResult { decision: "select_track" | "no_track"; selected: { track_id: string; usage: "intro" | "main"; start_sec: number; end_sec?: number; loop: boolean; }[]; mixing: { music_volume_db: number; ducking_db: number; fade_in_sec: number; fade_out_sec: number; sidechain: boolean; }; notes: string; }
export interface QAResult { status: 'PASS' | 'FAIL'; reason?: string; checks: string[]; }
export interface YouTubeAuthConfig { clientId: string; clientSecret?: string; redirectUri: string; }
export interface YouTubeChannelDetails { id: string; title: string; thumbnail: string; customUrl?: string; }
export interface AuthSettings { enabled: boolean; username?: string; passwordHash?: string; lockAfterMinutes: number; }
export interface AppSettings { serverUrl: string; serverStatus: 'connected' | 'disconnected'; theme: 'dark' | 'light'; debugMode: boolean; }
