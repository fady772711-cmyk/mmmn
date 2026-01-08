
import { Channel, ProviderConfig, VoicePreset, ProductionRun, AutomationConfig, DailyPlan, ProviderType, YouTubeAuthConfig, ProductionJob, SceneDefinition } from '../types';
import { MOCK_CHANNELS, MOCK_JOBS } from './mockData';

// Keys for localStorage
const KEYS = {
  CHANNELS: 'av_channels',
  PROVIDERS: 'av_providers',
  VOICES: 'av_voices',
  AGENTS: 'av_agents',
  RUNS: 'av_runs',
  AUTOMATIONS: 'av_automations_v2', // Changed key to avoid conflict with legacy
  PLANS: 'av_daily_plans',
  YT_CONFIG: 'av_yt_config',
  GLOBAL_USAGE: 'av_global_usage'
};

// Initial Seed Data (If DB is empty)
const SEED_PROVIDERS: ProviderConfig[] = [
  { id: 'prov_1', name: 'Google Gemini', type: ProviderType.LLM, providerId: 'gemini', isEnabled: true, status: 'operational' },
  { id: 'prov_2', name: 'Midjourney (Simulated)', type: ProviderType.IMAGE, providerId: 'midjourney', isEnabled: false, status: 'untested' },
  { id: 'prov_3', name: 'ElevenLabs', type: ProviderType.VOICE, providerId: 'elevenlabs', isEnabled: true, status: 'untested' }
];

const SEED_VOICES: VoicePreset[] = [
  { id: 'voice_1', name: 'Rami (Deep)', providerId: 'prov_3', nativeVoiceId: 'rami_123', gender: 'Male', style: 'Documentary', languageCode: 'ar-SA' },
  { id: 'voice_2', name: 'Layla (News)', providerId: 'prov_3', nativeVoiceId: 'layla_456', gender: 'Female', style: 'News', languageCode: 'ar-AE' }
];

export interface TokenUsageStats {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    estimatedCost: number; // In USD
}

const PRICE_INPUT_PER_M = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- IndexedDB Helper ---
const DB_NAME = 'AutoVideoOS_DB';
const STORE_JOBS = 'jobs';
const DB_VERSION = 1;

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_JOBS)) {
                db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
            }
        };
    });
};

const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const idbPut = async <T>(storeName: string, item: T): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

class StorageService {
  
  private load<T>(key: string, seed: T[] = []): T[] {
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(data);
  }

  private save<T>(key: string, data: T[]) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
            console.error("LocalStorage Quota Exceeded for key:", key);
        }
    }
  }

  // --- Channels ---
  async getChannels(): Promise<Channel[]> {
    await delay(100);
    const channels = this.load<Channel>(KEYS.CHANNELS);
    if (channels.length === 0) {
       const initial = MOCK_CHANNELS.map(c => ({...c, createdAt: new Date().toISOString()}));
       this.save(KEYS.CHANNELS, initial);
       return initial;
    }
    return channels;
  }

  async saveChannel(channel: Channel): Promise<void> {
    await delay(200);
    const channels = await this.getChannels();
    const index = channels.findIndex(c => c.id === channel.id);
    if (index >= 0) {
      channels[index] = channel;
    } else {
      channels.push(channel);
    }
    this.save(KEYS.CHANNELS, channels);
  }

  // --- Providers ---
  async getProviders(): Promise<ProviderConfig[]> {
    await delay(100);
    return this.load<ProviderConfig>(KEYS.PROVIDERS, SEED_PROVIDERS);
  }

  async saveProvider(provider: ProviderConfig): Promise<void> {
    await delay(200);
    const list = await this.getProviders();
    const index = list.findIndex(p => p.id === provider.id);
    if (index >= 0) list[index] = provider;
    else list.push(provider);
    this.save(KEYS.PROVIDERS, list);
  }

  // --- Voices ---
  async getVoices(): Promise<VoicePreset[]> {
    await delay(100);
    return this.load<VoicePreset>(KEYS.VOICES, SEED_VOICES);
  }

  async saveVoice(voice: VoicePreset): Promise<void> {
    await delay(200);
    const list = await this.getVoices();
    const index = list.findIndex(v => v.id === voice.id);
    if (index >= 0) list[index] = voice;
    else list.push(voice);
    this.save(KEYS.VOICES, list);
  }

  // --- Automations (New) ---
  async getAutomations(): Promise<AutomationConfig[]> {
      return this.load<AutomationConfig>(KEYS.AUTOMATIONS, []);
  }

  async saveAutomation(config: AutomationConfig): Promise<void> {
      const list = await this.getAutomations();
      const index = list.findIndex(a => a.id === config.id);
      if (index >= 0) list[index] = config;
      else list.push(config);
      this.save(KEYS.AUTOMATIONS, list);
  }

  async deleteAutomation(id: string): Promise<void> {
      const list = await this.getAutomations();
      this.save(KEYS.AUTOMATIONS, list.filter(a => a.id !== id));
  }

  // --- Daily Plans (New) ---
  async getDailyPlans(): Promise<DailyPlan[]> {
      return this.load<DailyPlan>(KEYS.PLANS, []);
  }

  async saveDailyPlan(plan: DailyPlan): Promise<void> {
      const list = await this.getDailyPlans();
      // Remove existing plan for same automation and date to overwrite
      const filtered = list.filter(p => !(p.automationId === plan.automationId && p.date === plan.date));
      filtered.push(plan);
      this.save(KEYS.PLANS, filtered);
  }

  // --- Runs (Phase 3) ---
  async getRuns(): Promise<ProductionRun[]> {
    return this.load<ProductionRun>(KEYS.RUNS, []);
  }

  // --- Jobs (IndexedDB) ---
  async getJobs(): Promise<ProductionJob[]> {
    try {
        const jobs = await idbGetAll<ProductionJob>(STORE_JOBS);
        jobs.forEach(job => {
            const scenesWithAudio = job.artifacts?.scenesWithAudio || [];
            scenesWithAudio.forEach((scene: SceneDefinition) => {
                if (scene.generatedAudioBlob && !scene.generatedAudioUrl) {
                    scene.generatedAudioUrl = URL.createObjectURL(scene.generatedAudioBlob);
                }
            });
            if (job.artifacts?.finalVideoBlob && !job.artifacts?.finalVideoUrl) {
                if (job.artifacts.finalVideoBlob instanceof Blob) {
                    job.artifacts.finalVideoUrl = URL.createObjectURL(job.artifacts.finalVideoBlob);
                }
            }
        });

        if (jobs.length === 0) {
             return [...MOCK_JOBS];
        }
        return jobs.sort((a, b) => parseInt(b.id.split('_')[1] || '0') - parseInt(a.id.split('_')[1] || '0'));
    } catch (e) {
        console.error("Failed to load jobs from IDB", e);
        return MOCK_JOBS;
    }
  }

  async saveJob(job: ProductionJob): Promise<void> {
    try {
        await idbPut(STORE_JOBS, job);
    } catch (e) {
        console.error("Failed to save job to IDB", e);
    }
  }

  // --- Global Usage Tracking ---
  async getGlobalUsage(): Promise<TokenUsageStats> {
      const data = localStorage.getItem(KEYS.GLOBAL_USAGE);
      return data ? JSON.parse(data) : { promptTokens: 0, responseTokens: 0, totalTokens: 0, estimatedCost: 0 };
  }

  async incrementUsage(prompt: number, response: number): Promise<void> {
      const current = await this.getGlobalUsage();
      const newPrompt = current.promptTokens + prompt;
      const newResponse = current.responseTokens + response;
      
      const costInput = (newPrompt / 1_000_000) * PRICE_INPUT_PER_M;
      const costOutput = (newResponse / 1_000_000) * PRICE_OUTPUT_PER_M;

      const updated: TokenUsageStats = {
          promptTokens: newPrompt,
          responseTokens: newResponse,
          totalTokens: newPrompt + newResponse,
          estimatedCost: costInput + costOutput
      };

      localStorage.setItem(KEYS.GLOBAL_USAGE, JSON.stringify(updated));
  }

  // --- YouTube Config ---
  async getYouTubeConfig(): Promise<YouTubeAuthConfig | null> {
    const data = localStorage.getItem(KEYS.YT_CONFIG);
    return data ? JSON.parse(data) : null;
  }

  async saveYouTubeConfig(config: YouTubeAuthConfig): Promise<void> {
    localStorage.setItem(KEYS.YT_CONFIG, JSON.stringify(config));
  }
}

export const db = new StorageService();
