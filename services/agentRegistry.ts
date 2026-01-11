
import { AgentRole, AgentStandardInput, AgentStandardResponse, SceneDefinition } from '../types';
import { db } from './storageService';
import * as geminiService from './geminiService';
import * as youtubeService from './youtubeService';
import * as videoAssembler from './videoAssembler';
import { generateOpenAIContent } from './openaiService'; 
import { MOCK_MUSIC_LIBRARY } from './mockData';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Resolve Configuration
const resolveAgentConfig = async (role: AgentRole): Promise<{ providerId: string; modelId: string; apiKey: string }> => {
    const dbConfig = await db.getAgentConfig(role);
    let providerId = dbConfig?.providerId || 'gemini';
    let modelId = dbConfig?.modelId || 'gemini-3-flash-preview';
    const providers = await db.getProviders();
    let apiKey = providers.find(p => p.providerId === providerId && p.apiKey)?.apiKey;
    
    // Fallback to Env if Gemini and key is missing/empty
    if ((!apiKey || apiKey.trim() === '') && providerId === 'gemini') {
        apiKey = process.env.API_KEY;
    }

    if (!apiKey) throw new Error(`API Key missing for provider: ${providerId}`);
    return { providerId, modelId, apiKey };
};

// --- BASE AGENT WRAPPER (Enforces Protocol) ---
const createAgent = (
    name: string,
    description: string,
    executeLogic: (input: AgentStandardInput, config: any) => Promise<any>
) => {
    return {
        name,
        description,
        execute: async (packet: AgentStandardInput): Promise<AgentStandardResponse> => {
            // 1. Strict Protocol Check
            if (!packet.meta || !packet.meta.fromAdminDirector) {
                return {
                    status: 'FAILURE',
                    output: null,
                    notes: [],
                    warnings: ['Unauthorized: Request must come from AdminDirector via CommandBus.']
                };
            }

            try {
                // 2. Load Config
                const config = await resolveAgentConfig(packet.role);
                
                // 3. Run Logic
                const output = await executeLogic(packet, config);
                
                return {
                    status: 'SUCCESS',
                    output: output,
                    notes: [`Executed ${name} successfully.`],
                    warnings: []
                };
            } catch (e: any) {
                return {
                    status: 'FAILURE',
                    output: null,
                    notes: [],
                    warnings: [e.message]
                };
            }
        }
    };
};

export const AgentRegistry = {
  
  // --- PRODUCTION AGENTS ---

  [AgentRole.SCRIPT_BUILDER]: createAgent('Script Builder', 'Generates full video scripts from outlines', async (packet, config) => {
      // Logic: If input has "script", just refine it. If "topic", generate from scratch.
      const { topic, isShorts } = packet.inputData;
      
      // Using Gemini Service directly for now (Logic Adapter)
      // Note: We are adapting the rigorous input to the existing service function signature
      const channel = (await db.getChannels())[0]; // Simplification for Admin Mode
      
      // Step 1: Strategy
      const strategy = await geminiService.runStrategyAgent(channel, topic, { videoType: isShorts ? 'Shorts' : 'Long', duration: { mode: 'fixed', unit: 'minutes', target_value: 1 } }, config.apiKey);
      
      // Step 2: Outline to Chapters
      const structure = await geminiService.runStructureAgent(strategy.data.outline, { mode: 'fixed', unit: 'minutes', target_value: 1 }, config.apiKey);
      
      // Step 3: Script
      const scriptData = await geminiService.runScriptBuilderAgent(structure.data.chapters, channel, config.apiKey);
      
      return { 
          scriptText: scriptData.data.script_final, 
          chapters: scriptData.data.chapters_content 
      };
  }),

  [AgentRole.VOICE_DIRECTOR]: createAgent('Voice Director', 'Generates audio voiceovers from text', async (packet, config) => {
      const { script } = packet.inputData;
      // Mocking audio generation for the "Whole Script" to save time/tokens in this demo
      // In real prod, we'd loop scenes.
      const blob = await geminiService.generateSpeech(script.scriptText.substring(0, 200) + "...", "Kore", config.apiKey);
      return { audioBlob: blob, audioUrl: URL.createObjectURL(blob) };
  }),

  [AgentRole.VISUAL_PRODUCER]: createAgent('Visual Producer', 'Generates images or videos for scenes', async (packet, config) => {
      const { script } = packet.inputData;
      // 1. Scene Plan
      const scenePlan = await geminiService.runScenePlannerAgent(script.scriptText, 'Cinematic', config.apiKey);
      
      // 2. Generate Image for first scene only (Demo Optimization)
      const firstScene = scenePlan.data.scenes[0];
      if (firstScene) {
          const imageUrl = await geminiService.generateImage(firstScene.visual_prompt, config.apiKey);
          firstScene.generatedImageUrl = imageUrl;
          firstScene.mediaType = 'image';
      }
      return { scenes: scenePlan.data.scenes };
  }),

  [AgentRole.MUSIC_DIRECTOR]: createAgent('Music Director', 'Selects and mixes background music', async (packet, config) => {
      // Select a random track from mock library
      const track = MOCK_MUSIC_LIBRARY[0];
      return { selectedTrack: track };
  }),

  [AgentRole.EDITOR_ASSEMBLER]: createAgent('Editor Assembler', 'Combines audio and visuals into final video', async (packet, config) => {
      const { visuals, voice, music } = packet.inputData;
      
      // Assemble using existing service
      const videoBlob = await videoAssembler.assembleVideo(
          visuals.scenes,
          '16:9',
          voice.audioUrl,
          music.selectedTrack.url
      );
      return { videoBlob, videoUrl: URL.createObjectURL(videoBlob) };
  }),

  [AgentRole.QA_REVIEWER]: createAgent('QA Reviewer', 'Checks quality of output', async (packet, config) => {
      // Mock QA
      const { video } = packet.inputData;
      if (video && video.videoBlob.size > 0) return { status: 'PASS', score: 98 };
      return { status: 'FAIL', reason: 'Empty video file' };
  }),

  [AgentRole.RISK_AGENT]: createAgent('Risk Agent', 'Checks content safety', async (packet, config) => {
      // Mock Risk Check
      return { safe: true, flags: [] };
  }),

  // --- OTHERS (Minimal implementations for Protocol compliance) ---
  [AgentRole.STRATEGY_DIRECTOR]: createAgent('Strategy', 'Develops content strategy', async () => ({})),
  [AgentRole.HOOK_MAKER]: createAgent('Hook', 'Creates viral hooks for shorts', async () => ({})),
  [AgentRole.TITLE_OPTIMIZER]: createAgent('Title', 'Optimizes video titles', async () => ({})),
  [AgentRole.TITLE_SELECTOR]: createAgent('Title Sel', 'Selects best title from options', async () => ({})),
  [AgentRole.STRUCTURE_AGENT]: createAgent('Structure', 'Structures video content', async () => ({})),
  [AgentRole.MICRO_SCRIPT_BUILDER]: createAgent('Micro Script', 'Builds short-form scripts', async () => ({})),
  [AgentRole.PACING_REVIEWER]: createAgent('Pacing', 'Reviews script pacing', async () => ({})),
  [AgentRole.SCENE_PLANNER]: createAgent('Scene', 'Plans visual scenes', async () => ({})),
  [AgentRole.ANALYST_AGENT]: createAgent('Analyst', 'Analyzes channel data', async () => ({})),
  [AgentRole.ADMIN_PLANNER]: createAgent('Planner', 'Plans content schedule', async () => ({})),
  [AgentRole.PUBLISHER]: createAgent('Publisher', 'Publishes content to platforms', async () => ({})),
  [AgentRole.SCHEDULER_AGENT]: createAgent('Scheduler', 'Triggers scheduled jobs', async () => ({}))
};
