
// Enums for rigid options
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
  SKIPPED = 'SKIPPED' // New status
}

export enum AgentRole {
  ADMIN_PLANNER = 'AdminPlanner', // New for Automations
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
  MUSIC_DIRECTOR = 'MusicDirector', // New Agent
  EDITOR_ASSEMBLER = 'EditorAssembler',
  QA_REVIEWER = 'QAReviewer',
  PUBLISHER = 'Publisher',
  THUMBNAIL_MAKER = 'ThumbnailMaker'
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

// --- Phase 1: Foundation Entities ---

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  providerId: string; 
  apiKey?: string; 
  isEnabled: boolean;
  status: 'operational' | 'error' | 'untested';
  lastTestedAt?: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  providerId: string; 
  nativeVoiceId: string; 
  gender: 'Male' | 'Female';
  style: string; 
  languageCode: string; 
  sampleUrl?: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  url: string; // Mock URL or real file path
  tags: string[];
  bpm?: number;
  mood?: string;
  genre?: string;
  length_seconds?: number;
  has_vocals?: boolean;
}

export interface YouTubeLinkedChannel {
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string;
  linkedAt: string;
  refreshToken?: string; 
}

export interface Channel {
  id: string;
  name: string;
  language: string; 
  tone: string; 
  visualStyle: string; 
  youtubeId?: string; 
  linkedYouTubeChannel?: YouTubeLinkedChannel; 
  status: 'active' | 'paused';
  
  defaultVoiceId?: string; 
  defaultProviderConfig?: Record<ProviderType, string>; 
  createdAt: string;
  
  niche?: string;
  audienceDescription?: string;
}

// --- Phase 3: Pipeline & Automation (Enhanced) ---

export interface AutomationAgentConfig {
  strategy: 'auto' | 'manual' | 'skip';
  script: 'auto' | 'manual' | 'skip';
  visuals: 'auto' | 'manual' | 'skip';
  voice: 'auto' | 'manual' | 'skip';
  music: 'auto' | 'off' | 'manual';
}

export interface AutomationVideoSpecs {
  durationUnit: 'seconds' | 'minutes';
  targetDuration: number;
  videosPerDay: number;
}

export interface AutomationVisualConfig {
  provider: 'nano_banana' | 'veo_3_1_fast' | 'veo_2' | 'imagen_3';
  mode: 'images' | 'video' | 'mixed';
  fallbackProvider?: string;
  
  // New Visual Settings
  imageQuantityMode: 'auto' | 'custom';
  imageQuantity?: number; // Only if custom
  enableTextOverlay: boolean;
  textOverlayStyle?: 'cinematic' | 'subtitles' | 'minimal' | 'bold';
}

export interface AutomationVoiceSettings {
  mode: 'auto_match_channel' | 'specific_preset';
  voicePresetId?: string; // If specific
  speed: number; // 0.8 to 1.2
}

export interface AutomationScheduleConfig {
  timezone: string;
  times: string[]; // ["09:00", "18:00"]
  days: string[]; // ["Mon", "Tue", ...]
  startDate: string;
  useAdminPlanner: boolean;
}

export interface AutomationConfig {
  id: string;
  name: string; // Friendly name
  channelId: string;
  pipelineLine: ProductionLine;
  isEnabled: boolean;
  
  // Detailed Configurations
  agents: AutomationAgentConfig;
  specs: AutomationVideoSpecs;
  visuals: AutomationVisualConfig;
  voiceSettings: AutomationVoiceSettings; // New Voice Settings
  schedule: AutomationScheduleConfig;
  
  publishMode: 'Draft' | 'Private' | 'Scheduled';
  lastRunAt?: string;
  
  // Legacy fields for backward compatibility (optional)
  videosPerDay?: number; 
  scheduleTimes?: string[];
  planningMode?: 'Manual' | 'Agent';
}

// Updated based on new spec
export interface PlannedItem {
  time: string;
  topic: string;
  title: string;
  angle: string;
  duration: number; // sec for shorts, min for long
  visual_provider: string;
}

export interface DailyPlan {
  id: string; // automationId_YYYY-MM-DD
  automationId: string;
  date: string;
  timezone: string;
  target_channel_id: string;
  items: PlannedItem[];
  generatedAt: string;
}

export interface AutomationRule {
  id: string;
  channelId: string;
  frequency: 'Daily' | 'Weekly';
  videosPerRun: number;
  videoType: ChannelType;
  publishMode: 'Manual' | 'Auto';
  createdAt: string;
}

export interface ProductionRun {
  id: string;
  channelId: string;
  name: string;
  triggerType: 'Schedule' | 'Manual' | 'Automation';
  automationId?: string;
  createdAt: string;
  status: JobStatus;
  progress: number;
}

export interface DurationConfig {
  mode: 'fixed' | 'range';
  unit: 'minutes' | 'seconds'; 
  target_value: number; 
  min_value?: number;
  max_value?: number;
  target_minutes?: number; 
  min_minutes?: number;
  max_minutes?: number;
}

export interface VisualConfig {
  mode: 'images' | 'video' | 'mixed';
  provider: 'nano_banana' | 'veo_3_1_fast' | 'veo_2'; 
  providerModel?: string; 
  fallback: 'images' | 'veo_2'; 
  quality: 'standard' | 'high';
  aspectRatio: '16:9' | '9:16'; 
}

export interface StepControl {
  title: 'manual' | 'agent';
  script: 'manual' | 'agent';
  scenes: 'manual' | 'agent';
  visuals: 'agent'; 
  voice: 'agent';
  music: 'auto' | 'off' | 'manual'; // New control
  publish: 'manual' | 'auto';
}

export interface ManualInputs {
  title?: string;
  script?: string;
  scenePlanJSON?: string;
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
  
  // Controls
  durationConfig?: DurationConfig; 
  visualConfig?: VisualConfig;
  stepControl?: StepControl;
  manualInputs?: ManualInputs;
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
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  agent: AgentRole;
  message: string;
  metadata?: any;
}

// --- Content Entities ---

export interface Scene {
  id: string;
  text: string; 
  visualPrompt: string; 
  imageUrl?: string; 
  audioUrl?: string; 
  duration?: number; 
}

export interface VideoScript {
  title: string;
  hook: string;
  angle: string;
  scenes: Scene[];
}

export interface AgentResult {
  ok: boolean;
  outputs: any;
  artifacts?: { type: string; data: any; label: string }[];
  errorMessage?: string;
  usage?: { prompt: number; candidates: number; total: number };
}

// --- Specialized Agent Outputs ---

export interface AdminPlannerResult {
  date: string;
  timezone: string;
  target_channel_id: string;
  items: PlannedItem[];
}

export interface StrategyResult {
  idea: string;
  angle: string;
  hooks: string[];
  promise: string;
  outline: string[];
}

export interface Chapter {
  title: string;
  objective: string;
  duration_seconds: number;
  break_points: string[];
}

export interface StructureResult {
  chapters: Chapter[];
}

export interface ScriptResult {
  script_final: string;
  chapters_content: { title: string; content: string }[];
}

export interface PacingResult {
  refined_script: string;
  notes: string[];
  improvements: string;
}

export interface TitleVariant {
  text: string;
  type: 'Curiosity' | 'Emotional' | 'Direct' | 'Informational';
}

export interface TitleResult {
  titles: TitleVariant[];
}

export interface TitleSelectionResult {
  selected_title: string;
  backup_title: string;
  reasoning: string;
}

export interface SceneDefinition {
  scene_id: string;
  duration_seconds: number;
  objective: string;
  visual_prompt: string;
  mood: string;
  shot_type: string;
  narration_text?: string; 
  
  generatedImageUrl?: string; 
  generatedVideoUrl?: string; 
  generatedAudioUrl?: string;
  
  generatedAudioBlob?: Blob; 
  generatedVideoBlob?: Blob;
  
  mediaType?: 'image' | 'video';
}

export interface ScenePlanResult {
  scenes: SceneDefinition[];
}

export interface MusicDirectorResult {
  decision: "select_track" | "no_track";
  selected: {
    track_id: string;
    usage: "intro" | "main";
    start_sec: number;
    end_sec?: number;
    loop: boolean;
  }[];
  mixing: {
    music_volume_db: number;
    ducking_db: number;
    fade_in_sec: number;
    fade_out_sec: number;
    sidechain: boolean;
  };
  notes: string;
}

export interface QAResult {
  status: 'PASS' | 'FAIL';
  reason?: string;
  checks: string[];
}

// --- OAuth Types ---
export interface YouTubeAuthConfig {
  clientId: string;
  clientSecret?: string; 
  redirectUri: string;
}

export interface YouTubeChannelDetails {
  id: string;
  title: string;
  thumbnail: string;
  customUrl?: string;
}
