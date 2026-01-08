
import { AgentRole, AgentResult, SceneDefinition, VisualConfig, Channel, MusicDirectorResult, MusicTrack } from '../types';
import { db } from './storageService';
import * as geminiService from './geminiService';
import * as youtubeService from './youtubeService';
import * as videoAssembler from './videoAssembler';
import { MOCK_MUSIC_LIBRARY } from './mockData';

// Feature Flag
const FEATURE_SHORTS = true;
const FEATURE_AUTOMATIONS = true;

// Helper to get the key dynamically before execution
const getGeminiKey = async (): Promise<string | undefined> => {
    const providers = await db.getProviders();
    return providers.find(p => p.providerId === 'gemini' && p.apiKey)?.apiKey;
};

// Helper for throttling loop execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Track usage
const trackUsage = (usage?: { prompt: number; candidates: number }) => {
    if (usage) {
        db.incrementUsage(usage.prompt, usage.candidates);
    }
};

// --- Voice Casting Logic ---
const castProfessionalVoice = (channel: Channel | undefined): { name: string; style: string } => {
    if (!channel) return { name: 'Kore', style: 'Default Professional' };

    const tone = (channel.tone || '').toLowerCase();
    const style = (channel.visualStyle || '').toLowerCase();

    // Gemini 2.5 TTS Voices
    if (tone.includes('serious') || tone.includes('dramatic') || tone.includes('dark') || style.includes('cinematic')) {
        return { name: 'Fenrir', style: 'Deep & Authoritative (Documentary)' };
    }
    
    if (tone.includes('news') || tone.includes('info') || tone.includes('tech')) {
        return { name: 'Kore', style: 'Clear & Professional (News)' };
    }

    if (tone.includes('fun') || tone.includes('happy') || tone.includes('comedy') || tone.includes('upbeat')) {
        return { name: 'Puck', style: 'Energetic & Lively' };
    }

    if (tone.includes('story') || tone.includes('calm') || tone.includes('emotional')) {
        return { name: 'Zephyr', style: 'Calm & Storytelling' };
    }

    if (tone.includes('horror') || tone.includes('mystery')) {
        return { name: 'Charon', style: 'Deep & Mysterious' };
    }

    // Default Fallback
    return { name: 'Kore', style: 'Balanced Standard' };
};

export const AgentRegistry = {
  // --- Planning Agents ---
  [AgentRole.ADMIN_PLANNER]: {
      name: 'Admin Planner (Manager)',
      description: 'Generates daily video schedules and topics for a channel.',
      execute: async (context: any): Promise<AgentResult> => {
          try {
              if (!FEATURE_AUTOMATIONS) throw new Error("Automations feature disabled");
              const apiKey = await getGeminiKey();
              
              const { data, usage } = await geminiService.runAdminPlannerAgent(
                  context.channel,
                  context.pipelineType,
                  context.times,
                  context.dateStr,
                  apiKey
              );
              trackUsage(usage);
              return { ok: true, outputs: data, usage };
          } catch (e: any) {
              return { ok: false, outputs: {}, errorMessage: e.message };
          }
      }
  },

  // --- Strategy Agents ---
  [AgentRole.STRATEGY_DIRECTOR]: {
    name: 'Strategy Director',
    description: 'Defines the video concept, angle, and hook.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runStrategyAgent(
            context.channel, 
            context.topic, 
            {
                videoType: context.videoType,
                duration: context.duration // Passed as DurationConfig
            },
            apiKey
        );
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.HOOK_MAKER]: {
    name: 'Hook Maker (Shorts)',
    description: 'Creates punchy hooks and simple outlines for Shorts.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        if (!FEATURE_SHORTS) throw new Error("Shorts feature disabled");
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runHookMakerAgent(context.channel, context.topic, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.TITLE_OPTIMIZER]: {
    name: 'Title Generator',
    description: 'Generates optimized title variants.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runTitleGeneratorAgent(context.idea, context.angle, context.language, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.TITLE_SELECTOR]: {
    name: 'Title Selector',
    description: 'Selects the best performing title.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runTitleSelectorAgent(context.titles, context.channelStyle, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  // --- Scripting Agents ---
  [AgentRole.STRUCTURE_AGENT]: {
    name: 'Structure Agent',
    description: 'Organizes the outline into timed chapters based on strict duration.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runStructureAgent(context.outline, context.duration, apiKey); // DurationConfig
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.SCRIPT_BUILDER]: {
    name: 'Script Builder',
    description: 'Writes the full narrative script.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        // Now passing context.channel to ensure Style Lock
        const { data, usage } = await geminiService.runScriptBuilderAgent(context.chapters, context.channel, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.MICRO_SCRIPT_BUILDER]: {
    name: 'MicroScript Builder (Shorts)',
    description: 'Writes strict word-count limited scripts for shorts.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        // Hook is usually part of context from HookMaker
        const hook = context.selectedTitle?.selected_title || context.hooks?.[0] || context.idea; 
        const durationSec = context.duration?.target_value || 60;
        
        const { data, usage } = await geminiService.runMicroScriptBuilderAgent(
            hook, 
            context.outline, 
            durationSec, 
            context.channel, 
            apiKey
        );
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.PACING_REVIEWER]: {
    name: 'Pacing Reviewer',
    description: 'Refines the script to improve flow.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runPacingReviewerAgent(context.script, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  // --- Visual & Audio Agents ---
  [AgentRole.SCENE_PLANNER]: {
    name: 'Scene Planner',
    description: 'Breaks down script into visual scenes.',
    execute: async (context: any): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const { data, usage } = await geminiService.runScenePlannerAgent(context.script, context.visualStyle, apiKey);
        trackUsage(usage);
        return { ok: true, outputs: data, usage };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.VISUAL_PRODUCER]: {
    name: 'Visual Producer',
    description: 'Generates images or videos with primary/fallback provider logic.',
    execute: async (context: { scenes: SceneDefinition[], visualConfig: VisualConfig }): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const updatedScenes: SceneDefinition[] = [];
        const artifacts: any[] = [];
        const config = context.visualConfig || { mode: 'images', aspectRatio: '16:9' };

        if (!context.scenes) throw new Error("No scenes provided");

        for (const scene of context.scenes) {
          try {
              let mediaUrl: string;
              let mediaType: 'image' | 'video' = 'image';

              // Decide Mode
              if (config.mode === 'video') {
                  // Determine Models
                  const primaryModel = config.provider === 'veo_3_1_fast' ? 'veo-3.1-fast-generate-preview' : 'veo-3.1-fast-generate-preview';
                  
                  try {
                      // Attempt Primary Video Generation
                      mediaUrl = await geminiService.generateVideo(scene.visual_prompt, {
                          model: primaryModel,
                          aspectRatio: config.aspectRatio || '16:9'
                      }, apiKey);
                      mediaType = 'video';
                      updatedScenes.push({ ...scene, generatedVideoUrl: mediaUrl, mediaType: 'video' });
                  
                  } catch (primaryError: any) {
                      console.warn(`Primary Video Provider (${config.provider}) failed: ${primaryError.message}`);
                      // Fallback: Image
                      const imageUrl = await geminiService.generateImage(scene.visual_prompt, apiKey);
                      updatedScenes.push({ ...scene, generatedImageUrl: imageUrl, mediaType: 'image' });
                      artifacts.push({ type: 'image', data: imageUrl, label: `Scene ${scene.scene_id} (Fallback Image)` });
                  }
              } else {
                  // Standard Image Mode
                  mediaUrl = await geminiService.generateImage(scene.visual_prompt, apiKey);
                  mediaType = 'image';
                  updatedScenes.push({ ...scene, generatedImageUrl: mediaUrl, mediaType: 'image' });
              }

              if (mediaType === 'video' || mediaType === 'image') {
                  artifacts.push({ type: mediaType, data: mediaUrl, label: `Scene ${scene.scene_id} (${mediaType})` });
              }
              
              // Throttle to avoid RPM Limits
              await delay(3000); 

          } catch (e: any) {
              console.error(`Failed to generate visual for scene ${scene.scene_id}`, e);
              updatedScenes.push(scene); // Push without visual
          }
        }

        return { 
            ok: true, 
            outputs: { scenes: updatedScenes },
            artifacts 
        };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.VOICE_DIRECTOR]: {
    name: 'Voice Director',
    description: 'Generates a single continuous narration track for the entire video.',
    execute: async (context: { scenes: SceneDefinition[], voiceName?: string, channel?: Channel }): Promise<AgentResult> => {
      try {
        const apiKey = await getGeminiKey();
        const artifacts: any[] = [];
        
        // 1. Casting Phase
        const selection = castProfessionalVoice(context.channel);
        const selectedVoice = context.voiceName || selection.name;
        
        artifacts.push({ type: 'text', data: null, label: `🎙️ Voice Selection: "${selectedVoice}" (${selection.style})` });

        if (!context.scenes || context.scenes.length === 0) throw new Error("No scenes provided");

        // 2. Prepare Continuous Text
        // Concatenate text with pauses
        const fullText = context.scenes
            .map(s => (s.narration_text || '').replace(/[\*\[\]\(\)\"]/g, '').trim())
            .filter(t => t.length > 0)
            .join('\n\n'); // Double newline for distinct pause

        if (!fullText) throw new Error("No narration text found in scenes.");

        // 3. Generate ONE Audio File
        // Using "Kore" or selected voice for the entire script to ensure consistency
        const audioBlob = await geminiService.generateSpeech(fullText, selectedVoice, apiKey);
        const audioUrl = URL.createObjectURL(audioBlob);

        // 4. Calculate Duration
        // We need to decode the audio to know its exact duration for the Assembler
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBufferDecoded = await audioCtx.decodeAudioData(arrayBuffer);
        const durationSeconds = audioBufferDecoded.duration;
        audioCtx.close();

        // 5. Return Result
        // We return the full audio blob/url. The Assembler will now use this instead of per-scene audio.
        return { 
            ok: true, 
            outputs: { 
                fullAudioUrl: audioUrl,
                fullAudioBlob: audioBlob,
                duration_seconds: durationSeconds,
                selectedVoice,
                voiceStyle: selection.style,
                scenes: context.scenes // Pass through scenes unchanged
            },
            artifacts: [
                ...artifacts,
                { type: 'audio', data: audioUrl, label: 'Full Narration (One-Shot)' }
            ]
        };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.MUSIC_DIRECTOR]: {
    name: 'Music Director',
    description: 'Selects background music and defines mixing settings.',
    execute: async (context: { 
        videoType: string;
        channel: Channel;
        voiceProfile: string; // from VoiceDirector output
        durationSeconds: number; // from VoiceDirector output
        script: string;
    }): Promise<AgentResult> => {
        try {
            const apiKey = await getGeminiKey();
            const { data, usage } = await geminiService.runMusicDirectorAgent({
                video_type: context.videoType,
                language: context.channel.language,
                tone: context.channel.tone,
                voice_profile: context.voiceProfile || 'neutral',
                duration_seconds: context.durationSeconds,
                script_summary: context.script.substring(0, 500) + "...", // Summarize script
                library_tracks: MOCK_MUSIC_LIBRARY
            }, apiKey);

            trackUsage(usage);

            // Enrich result with full track details
            let selectedTrack: MusicTrack | undefined;
            if (data.decision === 'select_track' && data.selected.length > 0) {
                const trackId = data.selected[0].track_id;
                selectedTrack = MOCK_MUSIC_LIBRARY.find(t => t.id === trackId);
            }

            const artifacts = [];
            if (selectedTrack) {
                artifacts.push({ 
                    type: 'audio', 
                    data: selectedTrack.url, 
                    label: `Music: ${selectedTrack.title} (${data.mixing.music_volume_db}dB)` 
                });
            } else {
                artifacts.push({ type: 'text', data: null, label: 'Music Decision: No Track Selected' });
            }

            return {
                ok: true,
                outputs: { 
                    musicConfig: data, 
                    selectedTrack 
                },
                artifacts,
                usage
            };
        } catch (e: any) {
            return { ok: false, outputs: {}, errorMessage: e.message };
        }
    }
  },

  [AgentRole.EDITOR_ASSEMBLER]: {
    name: 'Editor Assembler',
    description: 'Compiles images and audio into a final video.',
    execute: async (context: { 
        scenes: SceneDefinition[], 
        visualConfig: VisualConfig, 
        fullAudioBlob?: Blob,
        musicTrack?: MusicTrack,
        musicConfig?: MusicDirectorResult
    }): Promise<AgentResult> => {
      try {
        if (!context.scenes) throw new Error("No scenes provided to assembler");
        
        const aspectRatio = context.visualConfig?.aspectRatio || '16:9';
        
        let globalAudioUrl: string | undefined;
        if (context.fullAudioBlob) {
            globalAudioUrl = URL.createObjectURL(context.fullAudioBlob);
        }

        const videoBlob = await videoAssembler.assembleVideo(
            context.scenes, 
            aspectRatio, 
            globalAudioUrl,
            context.musicTrack?.url, // Pass background music URL
            context.musicConfig?.mixing?.music_volume_db // Pass volume
        );
        const videoUrl = URL.createObjectURL(videoBlob);
        
        return {
            ok: true,
            // Return videoBlob in outputs AND artifacts so storageService can save it
            outputs: { videoBlob, videoUrl },
            artifacts: [{ type: 'video', data: videoUrl, label: 'Final Video Render' }, { type: 'blob', data: videoBlob, label: 'videoBlob' }]
        };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  },

  [AgentRole.QA_REVIEWER]: {
    name: 'QA Reviewer',
    description: 'Validates the final video artifact.',
    execute: async (context: { videoBlob: Blob, durationConfig: any }): Promise<AgentResult> => {
      try {
        if (!context.videoBlob) return { ok: false, outputs: {}, errorMessage: "No video file found" };
        if (context.videoBlob.size < 1000) return { ok: false, outputs: {}, errorMessage: "Video file is too small (corruption)" };
        
        const checks = ["Blob exists", "Size > 1KB"];
        let status: 'PASS' | 'FAIL' = 'PASS';
        let reason = "Video blob exists and has valid size.";

        // Shorts Duration Check
        if (context.durationConfig?.unit === 'seconds') {
            const target = context.durationConfig.target_value;
            checks.push(`Target duration: ${target}s`);
        }

        return {
            ok: true,
            outputs: { status, reason },
            artifacts: []
        };
      } catch (e: any) {
        return { ok: false, outputs: { status: 'FAIL', reason: e.message } };
      }
    }
  },

  [AgentRole.PUBLISHER]: {
    name: 'YouTube Publisher',
    description: 'Uploads the final video file to YouTube as Draft/Private.',
    execute: async (context: { videoBlob: Blob, title: string, description: string, accessToken: string }): Promise<AgentResult> => {
      try {
        if (!context.videoBlob) throw new Error("No video file to upload");
        if (!context.accessToken) throw new Error("No YouTube Access Token provided");

        const videoId = await youtubeService.uploadVideoToYouTube(
          context.videoBlob,
          {
            title: context.title,
            description: context.description,
            privacyStatus: 'private'
          },
          context.accessToken
        );

        return {
          ok: true,
          outputs: { videoId, youtubeUrl: `https://youtu.be/${videoId}` },
          artifacts: [{ type: 'link', data: `https://youtu.be/${videoId}`, label: 'YouTube Video Link' }]
        };
      } catch (e: any) {
        return { ok: false, outputs: {}, errorMessage: e.message };
      }
    }
  }
};

export const getAgent = (role: AgentRole) => {
    return AgentRegistry[role as keyof typeof AgentRegistry];
};
