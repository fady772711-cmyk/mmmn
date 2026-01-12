
import { Channel, ProviderConfig, VoicePreset, ProductionRun, AutomationConfig, DailyPlan, ProviderType, YouTubeAuthConfig, ProductionJob, SceneDefinition, AgentConfiguration, AgentRole, AuthSettings, AppSettings, AdminJob, DevelopmentTicket, AgentMetrics, Campaign } from '../types';
import { MOCK_CHANNELS, MOCK_JOBS } from './mockData';

// Keys for localStorage
const KEYS = {
  CHANNELS: 'av_channels',
  PROVIDERS: 'av_providers',
  VOICES: 'av_voices',
  AGENTS: 'av_agents',
  AGENT_CONFIGS: 'av_agent_configs',
  RUNS: 'av_runs',
  AUTOMATIONS: 'av_automations_v2', 
  CAMPAIGNS: 'av_campaigns', // New Key
  PLANS: 'av_daily_plans',
  YT_CONFIG: 'av_yt_config',
  GLOBAL_USAGE: 'av_global_usage',
  AUTH_SETTINGS: 'av_auth_settings',
  APP_SETTINGS: 'av_app_settings',
  ADMIN_JOBS: 'av_admin_jobs',
  DEV_TICKETS: 'av_dev_tickets',
  METRICS: 'av_metrics' 
};

// ... (Existing Seed Data)
const SEED_PROVIDERS: ProviderConfig[] = [
  { 
      id: 'prov_1', 
      name: 'Google Gemini', 
      type: ProviderType.LLM, 
      providerId: 'gemini', 
      isEnabled: true, 
      status: 'operational',
      apiKey: process.env.API_KEY, 
      models: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash']
  },
  { 
      id: 'prov_openai', 
      name: 'OpenAI GPT', 
      type: ProviderType.LLM, 
      providerId: 'openai', 
      isEnabled: false, 
      status: 'untested',
      models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  { id: 'prov_2', name: 'Midjourney (Simulated)', type: ProviderType.IMAGE, providerId: 'midjourney', isEnabled: false, status: 'untested' },
  { id: 'prov_3', name: 'ElevenLabs', type: ProviderType.VOICE, providerId: 'elevenlabs', isEnabled: true, status: 'untested' }
];

const SEED_VOICES: VoicePreset[] = [
  { id: 'voice_1', name: 'Rami (Deep)', providerId: 'prov_3', nativeVoiceId: 'rami_123', gender: 'Male', style: 'Documentary', languageCode: 'ar-SA' },
  { id: 'voice_2', name: 'Layla (News)', providerId: 'prov_3', nativeVoiceId: 'layla_456', gender: 'Female', style: 'News', languageCode: 'ar-AE' }
];

// ... (Rest of existing methods until Automation)

export interface TokenUsageStats {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    estimatedCost: number; // In USD
}

const PRICE_INPUT_PER_M = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- IndexedDB Helper (Same as before) ---
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

  // ... (Previous Channel, Provider, Voice, AgentConfig methods remain identical)
  
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

  async getAgentConfigs(): Promise<AgentConfiguration[]> {
      return this.load<AgentConfiguration>(KEYS.AGENT_CONFIGS, []);
  }

  async getAgentConfig(role: AgentRole): Promise<AgentConfiguration | undefined> {
      const configs = await this.getAgentConfigs();
      return configs.find(c => c.agentRole === role);
  }

  async saveAgentConfig(config: AgentConfiguration): Promise<void> {
      const list = await this.getAgentConfigs();
      const index = list.findIndex(c => c.agentRole === config.agentRole);
      if (index >= 0) list[index] = config;
      else list.push(config);
      this.save(KEYS.AGENT_CONFIGS, list);
  }

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

  // --- Automations (Legacy) ---
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

  // --- CAMPAIGNS (NEW) ---
  async getCampaigns(): Promise<Campaign[]> {
      return this.load<Campaign>(KEYS.CAMPAIGNS, []);
  }

  async saveCampaign(campaign: Campaign): Promise<void> {
      const list = await this.getCampaigns();
      const index = list.findIndex(c => c.id === campaign.id);
      if (index >= 0) list[index] = campaign;
      else list.push(campaign);
      this.save(KEYS.CAMPAIGNS, list);
  }

  async deleteCampaign(id: string): Promise<void> {
      const list = await this.getCampaigns();
      this.save(KEYS.CAMPAIGNS, list.filter(c => c.id !== id));
  }

  // --- Plans ---
  async getDailyPlans(): Promise<DailyPlan[]> {
      return this.load<DailyPlan>(KEYS.PLANS, []);
  }

  async saveDailyPlan(plan: DailyPlan): Promise<void> {
      const list = await this.getDailyPlans();
      const filtered = list.filter(p => !(p.automationId === plan.automationId && p.date === plan.date));
      filtered.push(plan);
      this.save(KEYS.PLANS, filtered);
  }

  // --- Jobs (IDB) ---
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
        if (jobs.length === 0) return [...MOCK_JOBS];
        return jobs.sort((a, b) => parseInt(b.id.split('_')[1] || '0') - parseInt(a.id.split('_')[1] || '0'));
    } catch (e) {
        console.error("Failed to load jobs", e);
        return MOCK_JOBS;
    }
  }

  async saveJob(job: ProductionJob): Promise<void> {
    try {
        await idbPut(STORE_JOBS, job);
    } catch (e) {
        console.error("Failed to save job", e);
    }
  }

  // --- Admin Jobs ---
  async getAdminJobs(): Promise<AdminJob[]> {
      return this.load<AdminJob>(KEYS.ADMIN_JOBS, []);
  }

  async saveAdminJob(job: AdminJob): Promise<void> {
      const list = await this.getAdminJobs();
      const index = list.findIndex(j => j.id === job.id);
      if (index >= 0) list[index] = job;
      else list.push(job);
      this.save(KEYS.ADMIN_JOBS, list);
  }

  async getAdminJob(id: string): Promise<AdminJob | undefined> {
      const list = await this.getAdminJobs();
      return list.find(j => j.id === id);
  }

  // --- Tickets ---
  async getTickets(): Promise<DevelopmentTicket[]> {
      return this.load<DevelopmentTicket>(KEYS.DEV_TICKETS, []);
  }

  async saveTicket(ticket: DevelopmentTicket): Promise<void> {
      const list = await this.getTickets();
      const index = list.findIndex(t => t.id === ticket.id);
      if (index >= 0) list[index] = ticket;
      else list.push(ticket);
      this.save(KEYS.DEV_TICKETS, list);
  }

  // --- Metrics ---
  async getAgentMetrics(): Promise<AgentMetrics[]> {
      return this.load<AgentMetrics>(KEYS.METRICS, []);
  }

  async saveAgentMetric(metric: AgentMetrics): Promise<void> {
      const list = await this.getAgentMetrics();
      const index = list.findIndex(m => m.role === metric.role);
      if (index >= 0) list[index] = metric;
      else list.push(metric);
      this.save(KEYS.METRICS, list);
  }

  // --- Usage ---
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

  // --- Settings ---
  async getAuthSettings(): Promise<AuthSettings> {
      const data = localStorage.getItem(KEYS.AUTH_SETTINGS);
      return data ? JSON.parse(data) : { enabled: false, lockAfterMinutes: 30 };
  }

  async saveAuthSettings(settings: AuthSettings): Promise<void> {
      localStorage.setItem(KEYS.AUTH_SETTINGS, JSON.stringify(settings));
  }

  async getAppSettings(): Promise<AppSettings> {
      const data = localStorage.getItem(KEYS.APP_SETTINGS);
      return data ? JSON.parse(data) : { serverUrl: 'http://localhost:3000', serverStatus: 'disconnected', theme: 'dark', debugMode: false };
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
      localStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify(settings));
  }

  async getYouTubeConfig(): Promise<YouTubeAuthConfig | null> {
    const data = localStorage.getItem(KEYS.YT_CONFIG);
    return data ? JSON.parse(data) : null;
  }

  async saveYouTubeConfig(config: YouTubeAuthConfig): Promise<void> {
    localStorage.setItem(KEYS.YT_CONFIG, JSON.stringify(config));
  }
}

export const db = new StorageService();
