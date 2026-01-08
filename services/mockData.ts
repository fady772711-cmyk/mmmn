
import { Channel, ProductionRun, ProductionJob, JobStatus, AgentRole, ChannelType, AutomationRule, MusicTrack, AutomationConfig } from '../types';

export const MOCK_CHANNELS: Channel[] = [
  {
    id: 'ch_1',
    name: 'أسرار التاريخ',
    language: 'ar-SA',
    tone: 'Serious, Dramatic',
    visualStyle: 'Dark, Cinematic, Archival',
    status: 'active',
    createdAt: '2023-11-15T10:00:00Z'
  },
  {
    id: 'ch_2',
    name: 'تكنولوجيا المستقبل',
    language: 'ar-EG',
    tone: 'Upbeat, Informative',
    visualStyle: 'Clean, 3D Render, Bright',
    status: 'active',
    createdAt: '2023-12-01T09:30:00Z'
  }
];

// Deprecated type but keeping for reference if needed
export const MOCK_AUTOMATIONS_RULES: AutomationRule[] = [
  {
    id: 'auto_1',
    channelId: 'ch_1',
    frequency: 'Weekly',
    videosPerRun: 1,
    videoType: ChannelType.STORY,
    publishMode: 'Manual',
    createdAt: '2024-01-05T14:20:00Z'
  }
];

export const MOCK_MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'm_1', title: 'Epic Historical Build', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', tags: ['Cinematic', 'Dramatic', 'Orchestral'], bpm: 90, mood: 'Serious', has_vocals: false },
  { id: 'm_2', title: 'Tech News Daily', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', tags: ['Electronic', 'Upbeat', 'News'], bpm: 120, mood: 'Energetic', has_vocals: false },
  { id: 'm_3', title: 'Deep Mystery', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', tags: ['Ambient', 'Dark', 'Mystery'], bpm: 60, mood: 'Mysterious', has_vocals: false },
  { id: 'm_4', title: 'Happy Lo-Fi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', tags: ['Lo-Fi', 'Calm', 'Study'], bpm: 85, mood: 'Calm', has_vocals: false },
  { id: 'm_5', title: 'Action Trailer', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', tags: ['Action', 'Percussion', 'Fast'], bpm: 140, mood: 'Intense', has_vocals: false },
];

export const MOCK_RUNS: ProductionRun[] = [
  {
    id: 'run_101',
    channelId: 'ch_1',
    name: 'دورة النشر الأسبوعية - السبت',
    triggerType: 'Schedule',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: JobStatus.RUNNING,
    progress: 45
  },
  {
    id: 'run_102',
    channelId: 'ch_2',
    name: 'فيديو عاجل: إطلاق GPT-5',
    triggerType: 'Manual',
    createdAt: new Date().toISOString(),
    status: JobStatus.PENDING,
    progress: 0
  }
];

const createSteps = (): any[] => [
  { id: 's1', agentRole: AgentRole.STRATEGY_DIRECTOR, name: 'تحديد الفكرة والزاوية', status: JobStatus.COMPLETED, retryCount: 0, outputSummary: 'تم تحديد الموضوع: سقوط روما' },
  { id: 's2', agentRole: AgentRole.TITLE_OPTIMIZER, name: 'توليد العناوين', status: JobStatus.COMPLETED, retryCount: 0, outputSummary: 'العنوان المختار: الليلة التي بكت فيها روما' },
  { id: 's3', agentRole: AgentRole.SCRIPT_BUILDER, name: 'كتابة السكربت', status: JobStatus.RUNNING, retryCount: 1, outputSummary: 'جاري كتابة الفصل الثالث...' },
  { id: 's4', agentRole: AgentRole.SCENE_PLANNER, name: 'تخطيط المشاهد', status: JobStatus.PENDING, retryCount: 0 },
  { id: 's5', agentRole: AgentRole.VISUAL_PRODUCER, name: 'إنتاج الصور', status: JobStatus.PENDING, retryCount: 0 },
  { id: 's6', agentRole: AgentRole.VOICE_DIRECTOR, name: 'توليد الصوت', status: JobStatus.PENDING, retryCount: 0 },
  { id: 's7', agentRole: AgentRole.EDITOR_ASSEMBLER, name: 'المونتاج النهائي', status: JobStatus.PENDING, retryCount: 0 },
  { id: 's8', agentRole: AgentRole.QA_REVIEWER, name: 'فحص الجودة', status: JobStatus.PENDING, retryCount: 0 },
];

export const MOCK_JOBS: ProductionJob[] = [
  {
    id: 'job_1',
    runId: 'run_101',
    title: 'الليلة التي بكت فيها روما',
    type: 'Long',
    currentStepIndex: 2,
    status: JobStatus.RUNNING,
    steps: createSteps(),
    artifacts: {
      strategy: { hook: "Did you know Rome didn't fall in a day, but in a whisper?", angle: "Emotional narrative" },
      titles: ["Why Rome Fell", "The Night Rome Cried", "Betrayal of Caesars"]
    },
    logs: [
      { timestamp: new Date().toISOString(), level: 'INFO', agent: AgentRole.STRATEGY_DIRECTOR, message: 'Start processing topic: Fall of Rome' },
      { timestamp: new Date().toISOString(), level: 'INFO', agent: AgentRole.STRATEGY_DIRECTOR, message: 'Strategy defined successfully' },
    ]
  }
];
