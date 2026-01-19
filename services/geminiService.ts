
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
    let clean = text.replace(/```json\n?|```/g, "").trim();
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

    clean = clean.replace(/,(\s*[}\]])/g, '$1'); 
    
    try {
        return JSON.parse(clean);
    } catch (e: any) {
        if (e.message && (e.message.includes("Unterminated string") || e.message.includes("Unexpected token"))) {
             try {
                 const oneLine = clean.replace(/[\n\r]/g, " ");
                 return JSON.parse(oneLine);
             } catch (e2) {}
        }
        if (e.message && (e.message.includes("end of JSON input") || e.message.includes("Unterminated string"))) {
            const possibleClosures = ['" }', '"] }', '"]', '}', ']', '] }', ' }', '"}]}'];
            for (const closure of possibleClosures) {
                try { return JSON.parse(clean + closure); } catch (e3) {}
            }
        }
        throw new Error(`JSON Parse Failed: ${e.message}. \nRaw text preview: ${clean.substring(0, 200)}...`);
    }
}

// --- Core Helper: Structured Generation ---
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

  const modelsToTry = [preferredModel];
  if (preferredModel.includes('gemini-3')) {
      if (!modelsToTry.includes('gemini-3-flash-preview')) modelsToTry.push('gemini-3-flash-preview');
      if (!modelsToTry.includes('gemini-2.5-flash')) modelsToTry.push('gemini-2.5-flash');
  } else if (preferredModel === 'gemini-2.5-flash') {
      modelsToTry.push('gemini-flash-latest');
  }

  let lastError: any;

  for (const model of modelsToTry) {
      try {
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
              continue;
          }
          throw e;
      }
  }

  console.error("All models failed. Last error:", lastError);
  if (isQuotaError(lastError)) throw new Error(`Quota exceeded for all attempted models. Please check your billing or API key.`);
  if (lastError.message?.includes("401") || lastError.status === 401) throw new Error("Authentication Failed (401). Please check your API Key.");
  throw lastError;
};

// --- Helper: PCM to WAV ---
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

// --- AGENTS IMPORTS ---

export const runAnalystAgent = async (channel: Channel, analyticsData: any, count: number, apiKey?: string): Promise<{ data: AnalystResult; usage: any }> => {
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

// --- 0. Admin Planner Agent ---
export const runAdminPlannerAgent = async (channel: Channel, pipelineType: ProductionLine, times: string[], dateStr: string, apiKey?: string): Promise<{ data: AdminPlannerResult; usage: any }> => {
    const prompt = `Plan ${pipelineType} for ${channel.name} on ${dateStr}. Times: ${JSON.stringify(times)}. Output JSON.`;
    const schema: Schema = { type: Type.OBJECT, properties: { date: {type:Type.STRING}, timezone: {type:Type.STRING}, target_channel_id: {type:Type.STRING}, items: {type:Type.ARRAY, items: {type:Type.OBJECT, properties: {time:{type:Type.STRING}, topic:{type:Type.STRING}, title:{type:Type.STRING}, angle:{type:Type.STRING}, duration:{type:Type.NUMBER}, visual_provider:{type:Type.STRING}}}} }, required: ["date", "items"] };
    return generateStructuredContent<AdminPlannerResult>(prompt, { temperature: 0.8, systemInstruction: "AdminPlanner. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
};

export const runStrategyAgent = async (channel: Channel, topic: string, options: { videoType: string; duration: DurationConfig; }, apiKey?: string): Promise<{ data: StrategyResult; usage: any }> => {
  const prompt = `Strategy for ${topic}. Tone: ${channel.tone}. Output JSON: idea, angle, hooks, promise, outline.`;
  const schema: Schema = { type: Type.OBJECT, properties: { idea: {type:Type.STRING}, angle: {type:Type.STRING}, hooks: {type:Type.ARRAY, items:{type:Type.STRING}}, promise: {type:Type.STRING}, outline: {type:Type.ARRAY, items:{type:Type.STRING}} } };
  return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.7, systemInstruction: "StrategyDirector. JSON Only.", schema, maxTokens: 8192 }, 'gemini-3-pro-preview', apiKey);
};

export const runHookMakerAgent = async (channel: Channel, topic: string, apiKey?: string): Promise<{ data: StrategyResult; usage: any }> => {
    const prompt = `Shorts Hook for ${topic}. Output JSON.`;
    const schema: Schema = { type: Type.OBJECT, properties: { idea: {type:Type.STRING}, angle: {type:Type.STRING}, hooks: {type:Type.ARRAY, items:{type:Type.STRING}}, promise: {type:Type.STRING}, outline: {type:Type.ARRAY, items:{type:Type.STRING}} } };
    return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.9, systemInstruction: "HookMaker. JSON Only.", schema }, 'gemini-3-pro-preview', apiKey);
};

export const runStructureAgent = async (outline: string[], duration: DurationConfig, apiKey?: string): Promise<{ data: StructureResult; usage: any }> => {
  const prompt = `Structure outline: ${JSON.stringify(outline)}. Output JSON chapters.`;
  const schema: Schema = { type: Type.OBJECT, properties: { chapters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, objective: { type: Type.STRING }, duration_seconds: { type: Type.NUMBER }, break_points: { type: Type.ARRAY, items: { type: Type.STRING } } } } } } };
  return generateStructuredContent<StructureResult>(prompt, { temperature: 0.5, systemInstruction: "StructureAgent. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
};

export const runScriptBuilderAgent = async (chapters: Chapter[], channel: Channel, apiKey?: string): Promise<{ data: ScriptResult; usage: any }> => {
  const prompt = `Write Script for ${channel.name}. Chapters: ${JSON.stringify(chapters)}. Output JSON.`;
  const schema: Schema = { type: Type.OBJECT, properties: { script_final: { type: Type.STRING }, chapters_content: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } } } };
  return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction: "ScriptBuilder. JSON Only.", schema, maxTokens: 8192 }, 'gemini-3-pro-preview', apiKey);
};

export const runMicroScriptBuilderAgent = async (hook: string, outline: string[], durationSec: number, channel: Channel, apiKey?: string): Promise<{ data: ScriptResult; usage: any }> => {
    const prompt = `MicroScript for Shorts. Hook: ${hook}. Output JSON.`;
    const schema: Schema = { type: Type.OBJECT, properties: { script_final: { type: Type.STRING }, chapters_content: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } } } };
    return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction: "MicroScriptBuilder. JSON Only.", schema }, "gemini-3-pro-preview", apiKey);
};

export const runPacingReviewerAgent = async (script: string, apiKey?: string): Promise<{ data: PacingResult; usage: any }> => {
  const prompt = `Review pacing: ${script.substring(0, 5000)}. Output JSON.`;
  const schema: Schema = { type: Type.OBJECT, properties: { refined_script: { type: Type.STRING }, notes: { type: Type.ARRAY, items: { type: Type.STRING } }, improvements: { type: Type.STRING } } };
  return generateStructuredContent<PacingResult>(prompt, { temperature: 0.2, systemInstruction: "PacingReviewer. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
};

export const runTitleGeneratorAgent = async (idea: string, angle: string, language: string, apiKey?: string): Promise<{ data: TitleResult; usage: any }> => {
  const prompt = `Generate titles for ${idea} (${angle}). Lang: ${language}. Output JSON.`;
  const schema: Schema = { type: Type.OBJECT, properties: { titles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, type: { type: Type.STRING } } } } } };
  return generateStructuredContent<TitleResult>(prompt, { temperature: 0.7, systemInstruction: "TitleGenerator. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
};

export const runTitleSelectorAgent = async (titles: TitleVariant[], channelStyle: string, apiKey?: string): Promise<{ data: TitleSelectionResult; usage: any }> => {
  const prompt = `Select best title from: ${JSON.stringify(titles)}. Style: ${channelStyle}. Output JSON.`;
  const schema: Schema = { type: Type.OBJECT, properties: { selected_title: { type: Type.STRING }, backup_title: { type: Type.STRING }, reasoning: { type: Type.STRING } } };
  return generateStructuredContent<TitleSelectionResult>(prompt, { temperature: 0.2, systemInstruction: "TitleSelector. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
};

export const runScenePlannerAgent = async (script: string, visualStyle: string, apiKey?: string): Promise<{ data: ScenePlanResult; usage: any }> => {
  const prompt = `Plan scenes for script: ${script}. Style: ${visualStyle}. Output JSON.`;
  const schema: Schema = { type: Type.OBJECT, properties: { scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { scene_id: { type: Type.STRING }, duration_seconds: { type: Type.NUMBER }, objective: { type: Type.STRING }, visual_prompt: { type: Type.STRING }, mood: { type: Type.STRING }, shot_type: { type: Type.STRING }, narration_text: { type: Type.STRING } } } } } };
  return generateStructuredContent<ScenePlanResult>(prompt, { temperature: 0.5, systemInstruction: "ScenePlanner. JSON Only.", schema, maxTokens: 8192 }, "gemini-3-flash-preview", apiKey);
};

export const runMusicDirectorAgent = async (context: any, apiKey?: string): Promise<{ data: MusicDirectorResult; usage: any }> => {
    const prompt = `Select music. Context: ${JSON.stringify(context)}. Output JSON.`;
    const schema: Schema = { type: Type.OBJECT, properties: { decision: { type: Type.STRING }, selected: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { track_id: { type: Type.STRING }, usage: { type: Type.STRING }, start_sec: { type: Type.NUMBER }, end_sec: { type: Type.NUMBER }, loop: { type: Type.BOOLEAN } } } }, mixing: { type: Type.OBJECT, properties: { music_volume_db: { type: Type.NUMBER }, ducking_db: { type: Type.NUMBER }, fade_in_sec: { type: Type.NUMBER }, fade_out_sec: { type: Type.NUMBER }, sidechain: { type: Type.BOOLEAN } } }, notes: { type: Type.STRING } } };
    return generateStructuredContent<MusicDirectorResult>(prompt, { temperature: 0.5, systemInstruction: "MusicDirector. JSON Only.", schema }, "gemini-3-flash-preview", apiKey);
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
                // CRITICAL FIX: Ensure responseModalities is set to AUDIO enum or correct string array
                // and contents is structured strictly.
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO], // Use Enum
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName }
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data received from Gemini TTS");

            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            return pcmToWav(bytes);
        } catch (e: any) {
            if (isVoiceError(e)) {
                console.warn(`Voice '${voiceName}' is not supported. Retrying with default 'Kore'...`);
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-preview-tts", 
                    contents: [{ parts: [{ text: text }] }],
                    config: {
                        responseModalities: [Modality.AUDIO],
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

    return withRetry(async () => {
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
        }

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

        if (!operation.done) throw new Error("Video generation timed out");
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video URI returned");

        const response = await fetch(`${videoUri}&key=${apiKey}`);
        if (!response.ok) throw new Error("Failed to download generated video");
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    });
};
