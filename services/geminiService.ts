
import { GoogleGenAI, Type, Modality, Schema } from "@google/genai";
import { Channel, StrategyResult, StructureResult, ScriptResult, PacingResult, TitleResult, Chapter, TitleSelectionResult, ScenePlanResult, TitleVariant, AgentResult, DurationConfig, AdminPlannerResult, ProductionLine, MusicTrack, MusicDirectorResult, AnalystResult } from "../types";
import { generateGeminiGenSpeech } from './geminiGenService';
import { db } from './storageService';

// Helper to safely get API key (Prioritize passed key, then env)
const getApiKey = (overriddenKey?: string): string => {
  const key = overriddenKey || process.env.API_KEY;
  if (!key || key.trim() === '') {
      throw new Error("Gemini API Key is missing. Please add it in the 'Providers' tab or set process.env.API_KEY.");
  }
  return key;
};

// --- Helper: Error Analysis ---
const isQuotaError = (e: any) => {
  const msg = e.message?.toLowerCase() || '';
  return e.status === 429 || 
         e.status === 503 || 
         msg.includes('429') || 
         msg.includes('quota') || 
         msg.includes('resource_exhausted') ||
         msg.includes('too many requests') ||
         msg.includes('limit: 0');
};

const isVoiceError = (e: any) => {
    const msg = e.message?.toLowerCase() || '';
    return msg.includes('voice name') && msg.includes('not supported');
};

// --- Helper: Retry Logic ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    // Immediate retry logic is handled inside generateStructuredContent for models, 
    // but this generic retry handles network blips or generic 429s if not handled deeper.
    if (retries > 0 && isQuotaError(e)) {
       let wait = baseDelay;
       const match = e.message?.match(/retry in (\d+(\.\d+)?)s/);
       if (match) {
           wait = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
       } else {
           wait = baseDelay * (4 - retries); // Exponential backoff
       }
       console.warn(`[Gemini Service] Rate limit hit. Waiting ${wait}ms before retry... (${retries} retries left)`);
       await sleep(wait);
       return withRetry(fn, retries - 1, baseDelay * 1.5);
    }
    
    // Retry on JSON Parse Errors
    if (retries > 0 && (e.message?.includes("JSON Parse Failed") || e.message?.includes("Unexpected end of JSON"))) {
        console.warn(`[Gemini Service] JSON Parse Error. Retrying... (${retries} retries left)`);
        await sleep(1000);
        return withRetry(fn, retries - 1, baseDelay);
    }

    throw e;
  }
}

// --- Helper: Robust JSON Parser ---
function cleanAndParseJson(text: string): any {
    // 1. Remove Markdown code blocks
    let clean = text.replace(/```json\n?|```/g, "").trim();
    
    // 2. Locate the JSON object/array wrappers
    const firstOpenBrace = clean.indexOf('{');
    const firstOpenBracket = clean.indexOf('[');
    let startIdx = -1;
    let endIdx = -1;

    if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        startIdx = firstOpenBrace;
        endIdx = clean.lastIndexOf('}');
    } else if (firstOpenBracket !== -1) {
        startIdx = firstOpenBracket;
        endIdx = clean.lastIndexOf(']');
    }

    if (startIdx !== -1) {
        if (endIdx !== -1) {
            clean = clean.substring(startIdx, endIdx + 1);
        } else {
            clean = clean.substring(startIdx);
        }
    }

    // 3. Fix Common GenAI JSON Errors
    clean = clean.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    
    try {
        return JSON.parse(clean);
    } catch (e: any) {
        // Fallback Strategy for Repairing Broken JSON
        if (e.message && (e.message.includes("Unterminated string") || e.message.includes("Unexpected token"))) {
             try {
                 const oneLine = clean.replace(/[\n\r]/g, " ");
                 return JSON.parse(oneLine);
             } catch (e2) {}
        }

        // Try appending closures
        if (e.message && (e.message.includes("end of JSON input") || e.message.includes("Unterminated string"))) {
            const possibleClosures = ['" }', '"] }', '"]', '}', ']', '] }', ' }', '"}]}'];
            for (const closure of possibleClosures) {
                try { return JSON.parse(clean + closure); } catch (e3) {}
            }
        }
        
        throw new Error(`JSON Parse Failed: ${e.message}. \nRaw text preview: ${clean.substring(0, 200)}...`);
    }
}

// --- Core Helper: Structured Generation with Usage Tracking & Model Fallback ---
interface GenerationConfig {
  temperature: number;
  systemInstruction: string;
  schema?: Schema; 
  maxTokens?: number;
}

const generateStructuredContent = async <T>(
  prompt: string,
  config: GenerationConfig,
  preferredModel: string = "gemini-3-flash-preview",
  apiKeyOverride?: string
): Promise<{ data: T; usage: { prompt: number; candidates: number; total: number } }> => {
  const apiKey = getApiKey(apiKeyOverride);
  const ai = new GoogleGenAI({ apiKey });

  // Fallback Chain Definition
  const modelsToTry = [preferredModel];
  
  // If requesting a Pro/v3 model, add fallbacks to Flash/v2
  if (preferredModel.includes('gemini-3')) {
      if (!modelsToTry.includes('gemini-3-flash-preview')) modelsToTry.push('gemini-3-flash-preview');
      if (!modelsToTry.includes('gemini-2.5-flash')) modelsToTry.push('gemini-2.5-flash');
  } else if (preferredModel === 'gemini-2.5-flash') {
      modelsToTry.push('gemini-flash-latest');
  }

  let lastError: any;

  for (const model of modelsToTry) {
      try {
          // Wrapped in a single-try logic because the loop handles the "retry with different model" aspect.
          // We can still use withRetry for network glitches on the *same* model if we wanted, 
          // but here we prioritize switching models on quota errors.
          console.log(`[Gemini] Requesting with model: ${model}`);
          
          const response = await ai.models.generateContent({
              model: model,
              contents: prompt,
              config: {
                  systemInstruction: config.systemInstruction + " IMPORTANT: Output strictly valid JSON. Do not include markdown formatting. NO trailing commas. NO newlines inside strings.",
                  temperature: config.temperature, 
                  responseMimeType: "application/json", 
                  responseSchema: config.schema,
                  maxOutputTokens: config.maxTokens || 4000, 
              }
          });

          const usage = {
              prompt: response.usageMetadata?.promptTokenCount || 0,
              candidates: response.usageMetadata?.candidatesTokenCount || 0,
              total: response.usageMetadata?.totalTokenCount || 0
          };

          const text = response.text || "{}";
          const data = cleanAndParseJson(text);
          
          return { data, usage };

      } catch (e: any) {
          lastError = e;
          if (isQuotaError(e)) {
              console.warn(`[Gemini] Model ${model} failed with quota/rate limit. Falling back to next model...`);
              continue; // Try next model in chain
          }
          // If it's not a quota error (e.g. invalid key, bad request), fail fast or let withRetry handle it if we wrapped it
          throw e;
      }
  }

  // If all models failed
  console.error("All models failed. Last error:", lastError);
  if (isQuotaError(lastError)) {
      throw new Error(`Quota exceeded for all attempted models. Please check your billing or API key.`);
  }
  
  if (lastError.message?.includes("401") || lastError.status === 401) {
        throw new Error("Authentication Failed (401). Please check your API Key.");
  }
  
  throw lastError;
};

// --- Helper: PCM to WAV Converter ---
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- NEW: Analyst Agent (Data Analysis & Strategy) ---

export const runAnalystAgent = async (
    channel: Channel,
    analyticsData: any,
    count: number,
    apiKey?: string
): Promise<{ data: AnalystResult; usage: any }> => {
    
    // Fallback order: Pro -> Flash -> 2.5 Flash
    const model = 'gemini-3-pro-preview';

    const systemInstruction = `أنت AnalystAgent، محلل بيانات خبير لقنوات اليوتيوب.
مهمتك:
1. تحليل أداء القناة والجمهور.
2. اقتراح مواضيع جديدة عالية الأداء (Viral Topics) بناءً على التحليل.
3. مراقبة تأثير الفيديوهات السابقة (Feedback Loop).

قواعد:
- حلل البيانات المقدمة بدقة.
- اقترح مواضيع تهم الجمهور الحالي وتجذب جمهوراً جديداً.
- التزم بنغمة القناة (${channel.tone}).
- المخرجات JSON فقط.`;

    const prompt = `
بيانات القناة الحالية:
- الاسم: ${channel.name}
- الوصف: ${channel.audienceDescription}
- النيتش: ${channel.niche}
- أداء آخر فيديوهات: ${JSON.stringify(analyticsData.recentVideos || [])}
- الترندات الحالية: ${JSON.stringify(analyticsData.trends || ['General Trends'])}

المطلوب:
1. ملخص التحليل.
2. تقييم الأداء.
3. اقتراح ${count} مواضيع جذابة جداً (Killer Topics).

صيغة JSON:
{
  "analysis_summary": "...",
  "identified_trends": ["..."],
  "performance_verdict": "Growing | Stable | Declining",
  "suggested_topics": [
    {
      "topic": "...",
      "reasoning": "...",
      "predicted_performance": "High"
    }
  ]
}`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            analysis_summary: { type: Type.STRING },
            identified_trends: { type: Type.ARRAY, items: { type: Type.STRING } },
            performance_verdict: { type: Type.STRING },
            suggested_topics: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                        predicted_performance: { type: Type.STRING }
                    }
                }
            }
        },
        required: ["analysis_summary", "suggested_topics"]
    };

    return generateStructuredContent<AnalystResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 4000 }, model, apiKey);
};

// --- Music Director Agent ---

export const runMusicDirectorAgent = async (
    context: {
        video_type: string;
        language: string;
        tone: string;
        voice_profile: string;
        duration_seconds: number;
        script_summary: string;
        library_tracks: MusicTrack[];
    },
    apiKey?: string
): Promise<{ data: MusicDirectorResult; usage: any }> => {

    const systemInstruction = `أنت MusicDirector داخل مصنع فيديوهات احترافي.
مهمتك: اختيار موسيقى خلفية مناسبة من مكتبة YouTube Audio Library فقط.
قواعد صارمة:
- اختر tracks بدون غناء فقط (has_vocals=false).
- الموسيقى خلفية لا تنافس الصوت.
- إذا لا يوجد تراك مناسب: decision="no_track".
- أخرج JSON فقط.`;

    const simplifiedTracks = context.library_tracks.map(t => ({
        id: t.id,
        title: t.title,
        tags: t.tags,
        bpm: t.bpm,
        mood: t.mood,
        has_vocals: t.has_vocals
    }));

    const prompt = `
المدخلات:
- video_type: ${context.video_type}
- tone: ${context.tone}
- script_summary: "${context.script_summary}"
- library_tracks: ${JSON.stringify(simplifiedTracks)}

صيغة الإخراج (JSON):
{
  "decision": "select_track" | "no_track",
  "selected": [{ "track_id": "…", "usage": "main", "start_sec": 0, "end_sec": null, "loop": true }],
  "mixing": { "music_volume_db": -18, "ducking_db": -12, "fade_in_sec": 2.5, "fade_out_sec": 3.0, "sidechain": true },
  "notes": "سبب الاختيار باختصار"
}`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            decision: { type: Type.STRING, enum: ["select_track", "no_track"] },
            selected: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { track_id: { type: Type.STRING }, usage: { type: Type.STRING }, start_sec: { type: Type.NUMBER }, end_sec: { type: Type.NUMBER }, loop: { type: Type.BOOLEAN } } } },
            mixing: { type: Type.OBJECT, properties: { music_volume_db: { type: Type.NUMBER }, ducking_db: { type: Type.NUMBER }, fade_in_sec: { type: Type.NUMBER }, fade_out_sec: { type: Type.NUMBER }, sidechain: { type: Type.BOOLEAN } } },
            notes: { type: Type.STRING }
        },
        required: ["decision", "selected", "mixing", "notes"]
    };

    return generateStructuredContent<MusicDirectorResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 2000 }, "gemini-3-flash-preview", apiKey);
};

// --- 0. Admin Planner Agent ---

export const runAdminPlannerAgent = async (
    channel: Channel,
    pipelineType: ProductionLine,
    times: string[],
    dateStr: string,
    apiKey?: string
): Promise<{ data: AdminPlannerResult; usage: any }> => {
    
    const systemInstruction = `أنت AdminPlanner داخل نظام أتمتة قناة يوتيوب.
مهمتك: إنشاء خطة نشر يومية.
- اقترح ${times.length} عناصر.
- لا تكتب سكربت.
- أخرج JSON فقط.`;

    const prompt = `
المدخلات:
- production_line: ${pipelineType}
- videos_per_day: ${times.length}
- times: ${JSON.stringify(times)}
- date: ${dateStr}

صيغة الإخراج المطلوبة (JSON Strict):
{
  "date": "YYYY-MM-DD",
  "timezone": "...",
  "target_channel_id": "${channel.id}",
  "items": [
      {
          "time": "HH:MM",
          "topic": "...",
          "title": "...",
          "angle": "...",
          "duration": 0,
          "visual_provider": "..."
      }
  ]
}
    `;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING },
            timezone: { type: Type.STRING },
            target_channel_id: { type: Type.STRING },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        time: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        title: { type: Type.STRING },
                        angle: { type: Type.STRING },
                        duration: { type: Type.NUMBER },
                        visual_provider: { type: Type.STRING }
                    }
                }
            }
        },
        required: ["date", "timezone", "target_channel_id", "items"]
    };

    return generateStructuredContent<AdminPlannerResult>(prompt, { temperature: 0.8, systemInstruction, schema, maxTokens: 4000 }, "gemini-3-flash-preview", apiKey);
};


// --- 1. Strategy Agent ---

export const runStrategyAgent = async (
  channel: Channel,
  topic: string,
  options: { videoType: string; duration: DurationConfig; },
  apiKey?: string
): Promise<{ data: StrategyResult; usage: any }> => {
  
  const model = 'gemini-3-pro-preview';
  const targetMin = options.duration.target_minutes || Math.ceil(options.duration.target_value / 60) || 5;

  const systemInstruction = `You are a StrategyDirector.
STYLE LOCK: Channel Tone: "${channel.tone}".
Duration Goal: ${targetMin} minutes.
Task: Choose ONE strong video idea and angle.
Output JSON only.`;

  const prompt = `Topic: ${topic}. Type: ${options.videoType}. Target Duration: ${targetMin} min.
Required JSON Output: Idea, Angle, Hooks (array), Promise, Outline (array of 5-8 items).`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      idea: { type: Type.STRING },
      angle: { type: Type.STRING },
      hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
      promise: { type: Type.STRING },
      outline: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["idea", "angle", "hooks", "promise", "outline"]
  };

  return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 8192 }, model, apiKey);
};

// --- 1.5 SHORTS: Hook Maker Agent ---

export const runHookMakerAgent = async (
    channel: Channel,
    topic: string,
    apiKey?: string
): Promise<{ data: StrategyResult; usage: any }> => {
    
    const model = 'gemini-3-pro-preview';
    const systemInstruction = `You are a HookMaker for Viral Shorts.
    Task: Create a killer hook and simple structure for a < 60s video.
    Output must be valid JSON.`;
  
    const prompt = `Topic: ${topic}. Create a Short Video Strategy.
    Output: Idea, Angle, Hooks (3 variations), Promise, Outline (3-4 bullet points max).`;
  
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        idea: { type: Type.STRING },
        angle: { type: Type.STRING },
        hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
        promise: { type: Type.STRING },
        outline: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["idea", "angle", "hooks", "promise", "outline"]
    };
  
    return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.9, systemInstruction, schema, maxTokens: 2000 }, model, apiKey);
};

// --- 2. Structure Agent ---

export const runStructureAgent = async (outline: string[], duration: DurationConfig, apiKey?: string): Promise<{ data: StructureResult; usage: any }> => {
  const targetMin = duration.target_minutes || 5;
  const systemInstruction = `You are a StructureAgent.
Duration Goal: ${targetMin} minutes.
Rules: Divide into chapters. Output JSON.`;

  const prompt = `Outline: ${JSON.stringify(outline)}. Return 'chapters' array with title, objective, duration_seconds.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      chapters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, objective: { type: Type.STRING }, duration_seconds: { type: Type.NUMBER }, break_points: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
    }
  };

  return generateStructuredContent<StructureResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 4000 }, "gemini-3-flash-preview", apiKey);
};

// --- 3. Script Builder Agent ---

export const runScriptBuilderAgent = async (
    chapters: Chapter[], 
    channel: Channel, 
    apiKey?: string
): Promise<{ data: ScriptResult; usage: any }> => {
  
  const model = 'gemini-3-pro-preview';
  const systemInstruction = `You are a ScriptBuilder.
Style: ${channel.tone}. Language: ${channel.language}.
Task: Write the full narrator script.
Rules: Short, punchy sentences. NO visual directions in the script text. Output JSON only.`;

  const prompt = `Chapters: ${JSON.stringify(chapters)}. Write full script content for each chapter.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      script_final: { type: Type.STRING },
      chapters_content: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } }
    }
  };

  return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 8192 }, model, apiKey);
};

// --- 3.5 SHORTS: MicroScript Builder ---

export const runMicroScriptBuilderAgent = async (
    hook: string,
    outline: string[],
    durationSec: number,
    channel: Channel,
    apiKey?: string
): Promise<{ data: ScriptResult; usage: any }> => {
    
    const systemInstruction = `You are a MicroScriptBuilder for Shorts.
    Duration Limit: ${durationSec} seconds. Language: ${channel.language}.
    Rules: Start immediately with the Hook. No fluff. Break into 4-6 mini-segments.`;

    const prompt = `Hook: "${hook}". Outline: ${JSON.stringify(outline)}. Write a continuous script optimized for ${durationSec}s vertical video.`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          script_final: { type: Type.STRING },
          chapters_content: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } }
        }
    };

    return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 2000 }, "gemini-3-pro-preview", apiKey);
};

// --- 4. Pacing Reviewer Agent ---

export const runPacingReviewerAgent = async (script: string, apiKey?: string): Promise<{ data: PacingResult; usage: any }> => {
  const systemInstruction = `You are a PacingReviewer. Task: Trim fluff by 10%. Keep it snappy. Output JSON only.`;
  const prompt = `Script: ${script.substring(0, 10000)}`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: { refined_script: { type: Type.STRING }, notes: { type: Type.ARRAY, items: { type: Type.STRING } }, improvements: { type: Type.STRING } }
  };

  return generateStructuredContent<PacingResult>(prompt, { temperature: 0.2, systemInstruction, schema, maxTokens: 8192 }, "gemini-3-flash-preview", apiKey);
};

// --- 5. Title Generator Agent ---

export const runTitleGeneratorAgent = async (idea: string, angle: string, language: string, apiKey?: string): Promise<{ data: TitleResult; usage: any }> => {
  const systemInstruction = `TitleGenerator. Rules: High CTR. Language: ${language}. Generate 5 variations. Output JSON.`;
  const prompt = `Idea: ${idea}. Angle: ${angle}.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      titles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, type: { type: Type.STRING, enum: ['Curiosity', 'Emotional', 'Direct', 'Informational'] } } } }
    }
  };

  return generateStructuredContent<TitleResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 2000 }, "gemini-3-flash-preview", apiKey);
};

// --- 6. Title Selector Agent ---

export const runTitleSelectorAgent = async (titles: TitleVariant[], channelStyle: string, apiKey?: string): Promise<{ data: TitleSelectionResult; usage: any }> => {
  const systemInstruction = `TitleSelector. Style: ${channelStyle}. Pick the best one.`;
  const prompt = `Titles: ${JSON.stringify(titles.map(t => t.text))}.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: { selected_title: { type: Type.STRING }, backup_title: { type: Type.STRING }, reasoning: { type: Type.STRING } },
    required: ["selected_title", "backup_title", "reasoning"]
  };

  return generateStructuredContent<TitleSelectionResult>(prompt, { temperature: 0.2, systemInstruction, schema, maxTokens: 2000 }, "gemini-3-flash-preview", apiKey);
};

// --- 7. Scene Planner Agent ---

export const runScenePlannerAgent = async (script: string, visualStyle: string, apiKey?: string): Promise<{ data: ScenePlanResult; usage: any }> => {
  const systemInstruction = `ScenePlanner. Style: ${visualStyle}.
Task: Create visual scenes from script. One scene per ~10s. Visual prompts must be descriptive English. Output JSON.`;

  const prompt = `Script: ${script}`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { scene_id: { type: Type.STRING }, duration_seconds: { type: Type.NUMBER }, objective: { type: Type.STRING }, visual_prompt: { type: Type.STRING }, mood: { type: Type.STRING }, shot_type: { type: Type.STRING }, narration_text: { type: Type.STRING } } } }
    }
  };

  return generateStructuredContent<ScenePlanResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 8192 }, "gemini-3-flash-preview", apiKey);
};

// --- Content Generation ---

export const generateSpeech = async (text: string, voiceName: string = 'Kore', apiKeyOverride?: string): Promise<Blob> => {
    
    // --- GEMINIGEN INTEGRATION with FALLBACK ---
    if (voiceName.startsWith('GM')) {
        try {
            const providers = await db.getProviders();
            const geminiGenProvider = providers.find(p => p.providerId === 'geminigen');
            
            if (geminiGenProvider && geminiGenProvider.apiKey) {
                console.log(`[Speech] Routing to GeminiGen.AI for voice ${voiceName}`);
                return await generateGeminiGenSpeech(text, voiceName, geminiGenProvider.apiKey);
            }
        } catch (e: any) {
            console.warn(`[Speech] GeminiGen failed for ${voiceName}. Falling back to standard Gemini. Error: ${e.message}`);
            // Fallback strategy: Map to a standard voice
            // Ideally we'd map male/female, but 'Kore' is a safe default female/neutral voice.
            // 'Fenrir' is male.
            // Simplified fallback:
            voiceName = 'Kore'; 
        }
    }
    
    // --- GOOGLE GEMINI TTS (Default) ---
    const apiKey = getApiKey(apiKeyOverride);
    const ai = new GoogleGenAI({ apiKey });

    return withRetry(async () => {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts", 
                // Ensure contents is an array of Content objects, each with a parts array.
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName }
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data received");

            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            return pcmToWav(bytes);
        } catch (e: any) {
            // Auto-repair for invalid voices (common user error or deprecated voice names)
            if (isVoiceError(e)) {
                console.warn(`Voice '${voiceName}' is not supported. Retrying with default 'Kore'...`);
                // Retry specifically with 'Kore'
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-preview-tts", 
                    contents: [{ parts: [{ text: text }] }],
                    config: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: 'Kore' }
                            }
                        }
                    }
                });
                
                const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (!base64Audio) throw new Error("No audio data received from fallback voice");

                const binaryString = atob(base64Audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return pcmToWav(bytes);
            }
            throw e;
        }
    });
};

export const generateImage = async (prompt: string, apiKeyOverride?: string): Promise<string> => {
    const apiKey = getApiKey(apiKeyOverride);
    const ai = new GoogleGenAI({ apiKey });

    // Chain: Gemini 2.5 Image -> Imagen 3 -> Error
    return withRetry(async () => {
        // 1. Try Gemini 2.5 Flash Image first
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }
        } catch (e: any) {
            console.warn("gemini-2.5-flash-image failed, attempting fallback to Imagen 3...", e.message);
            // Don't throw quota errors yet, try fallback first
        }

        // 2. Fallback to Imagen 3
        try {
            const response = await ai.models.generateImages({
                model: "imagen-3.0-generate-001",
                prompt: prompt,
                config: { numberOfImages: 1, aspectRatio: "16:9", outputMimeType: "image/jpeg" }
            });

            const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
            if (base64Data) {
                return `data:image/jpeg;base64,${base64Data}`;
            }
        } catch (e: any) {
            console.error("Imagen 3 failed", e);
            throw e;
        }
        
        throw new Error("No image generated from any provider");
    });
};

export const generateVideo = async (prompt: string, options: { model?: string, aspectRatio?: '16:9' | '9:16' } = {}, apiKeyOverride?: string): Promise<string> => {
    const apiKey = getApiKey(apiKeyOverride);
    const ai = new GoogleGenAI({ apiKey });

    const modelName = options.model || 'veo-3.1-fast-generate-preview';
    const aspectRatio = options.aspectRatio || '16:9';

    // Veo doesn't have an easy fallback other than maybe older Veo or just failing gracefully.
    // We stick to the requested model but add robust retry.
    return withRetry(async () => {
        let operation = await ai.models.generateVideos({
            model: modelName, 
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
        });

        const maxRetries = 60; 
        let retries = 0;

        while (!operation.done && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000)); 
            operation = await ai.operations.getVideosOperation({ operation: operation });
            retries++;
        }

        if (!operation.done) {
            throw new Error("Video generation timed out");
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video URI returned");

        const response = await fetch(`${videoUri}&key=${apiKey}`);
        if (!response.ok) throw new Error("Failed to download generated video");

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    });
};
