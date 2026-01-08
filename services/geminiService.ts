
import { GoogleGenAI, Type, Modality, Schema } from "@google/genai";
import { Channel, StrategyResult, StructureResult, ScriptResult, PacingResult, TitleResult, Chapter, TitleSelectionResult, ScenePlanResult, TitleVariant, AgentResult, DurationConfig, AdminPlannerResult, ProductionLine, MusicTrack, MusicDirectorResult } from "../types";

// Helper to safely get API key (Prioritize passed key, then env)
const getApiKey = (overriddenKey?: string): string => {
  const key = overriddenKey || process.env.API_KEY;
  if (!key || key.trim() === '') {
      throw new Error("Gemini API Key is missing. Please add it in the 'Providers' tab or set process.env.API_KEY.");
  }
  return key;
};

// --- Helper: Retry Logic ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 5000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    // Check for Rate Limit (429) or Service Unavailable (503)
    if (retries > 0 && (e.status === 429 || e.status === 503 || e.message?.includes('429') || e.message?.includes('quota'))) {
       let wait = baseDelay;
       // Try to parse "retry in X seconds" from error message
       const match = e.message?.match(/retry in (\d+(\.\d+)?)s/);
       if (match) {
           wait = Math.ceil(parseFloat(match[1]) * 1000) + 2000; // Add 2s buffer
       } else {
           wait = baseDelay * (4 - retries); // 5000, 10000, 15000
       }
       console.warn(`[Gemini Service] Rate limit hit. Waiting ${wait}ms before retry... (${retries} retries left)`);
       await sleep(wait);
       return withRetry(fn, retries - 1, baseDelay);
    }
    
    // Retry on JSON Parse Errors (often transient model glitches)
    if (retries > 0 && (e.message?.includes("JSON Parse Failed") || e.message?.includes("Unexpected end of JSON"))) {
        console.warn(`[Gemini Service] JSON Parse Error. Retrying... (${retries} retries left)`);
        await sleep(2000);
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
            // Truncated? Start from the first brace but keep the rest
            clean = clean.substring(startIdx);
        }
    }

    // 3. Fix Common GenAI JSON Errors
    // Remove trailing commas
    clean = clean.replace(/,(\s*[}\]])/g, '$1');
    
    // Attempt Parse
    try {
        return JSON.parse(clean);
    } catch (e: any) {
        // Fallback Strategy for Repairing Broken JSON
        
        // Strategy A: Fix unescaped newlines in strings (Common in Arabic output)
        if (e.message && (e.message.includes("Unterminated string") || e.message.includes("Unexpected token"))) {
             try {
                 const oneLine = clean.replace(/[\n\r]/g, " ");
                 return JSON.parse(oneLine);
             } catch (e2) {}
        }

        // Strategy B: Append common closure patterns
        // This helps if the model stopped right at the end
        if (e.message && (e.message.includes("end of JSON input") || e.message.includes("Unterminated string"))) {
            const possibleClosures = [
                '" }',       // Close string then object
                '"] }',      // Close string then array then object
                '"]',        // Close string then array
                '}',         // Close object
                ']',         // Close array
                '] }',       // Close array then object
                ' }',        // Just space and object
                '"}]}',      // Close string -> Object end -> Array end -> Root Object end
                '}]}'        // Object end -> Array end -> Root Object end
            ];

            for (const closure of possibleClosures) {
                try {
                    return JSON.parse(clean + closure);
                } catch (e3) {}
            }
            
            // Strategy C: Aggressive Truncation (Backtrack to last valid object in an array)
            // Use case: The list of scenes was cut off in the middle of scene #10.
            // Action: Discard the incomplete scene #10 and close the array after scene #9.
            // Look for the last occurrence of "}," which signifies the end of a previous object in a list.
            const lastObjectEnd = clean.lastIndexOf("},");
            if (lastObjectEnd !== -1) {
                 const truncated = clean.substring(0, lastObjectEnd + 1); // Keep the "}," but regex below removes comma
                 const truncatedClean = truncated.replace(/,$/, ""); // Remove the trailing comma
                 const closures = [']}', ']']; // Try closing array + root, or just array
                 for (const closure of closures) {
                    try { return JSON.parse(truncatedClean + closure); } catch (e4) {}
                 }
            }
        }
        
        throw new Error(`JSON Parse Failed: ${e.message}. \nRaw text preview: ${clean.substring(0, 200)}...`);
    }
}

// --- Core Helper: Structured Generation with Usage Tracking ---
interface GenerationConfig {
  temperature: number;
  systemInstruction: string;
  schema?: Schema; 
  maxTokens?: number;
}

const generateStructuredContent = async <T>(
  prompt: string,
  config: GenerationConfig,
  modelName: string = "gemini-2.5-flash", 
  apiKeyOverride?: string
): Promise<{ data: T; usage: { prompt: number; candidates: number; total: number } }> => {
  const apiKey = getApiKey(apiKeyOverride);
  const ai = new GoogleGenAI({ apiKey });

  return withRetry(async () => {
    try {
        const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
            // Explicitly forbid trailing commas and newlines in strings
            systemInstruction: config.systemInstruction + " IMPORTANT: Output strictly valid JSON. Do not include markdown formatting. NO trailing commas. NO newlines inside strings. Escape all double quotes within strings.",
            temperature: config.temperature, 
            responseMimeType: "application/json", 
            responseSchema: config.schema,
            // Optimization: Adjusted limits. 
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
        console.error("Agent Execution Error:", e);
        
        if (e.message?.includes("401") || e.status === 401) {
             throw new Error("Authentication Failed (401). Please check your API Key in the 'Providers' tab.");
        }
        
        if (e.message?.includes("404") || e.status === 404) {
            throw new Error(`Model '${modelName}' not found. Check if your API Key has access to this model.`);
        }

        throw e; 
    }
  });
};

// --- Helper: PCM to WAV Converter ---
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  // data chunk
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

مهمتك:
اختيار موسيقى خلفية مناسبة من مكتبة YouTube Audio Library فقط.

المدخلات:
- video_type: {long_narrative | long_explainer | shorts}
- tone: {cinematic | documentary | mysterious | calm | motivational}
- voice_profile: {calm | neutral | intense}
- duration_seconds
- script_summary
- library_tracks (من YouTube Audio Library فقط)

قواعد صارمة:
- اختر tracks بدون غناء فقط (has_vocals=false).
- الموسيقى خلفية لا تنافس الصوت.
- لا تختار أكثر من 2 tracks.
- إذا لا يوجد تراك مناسب: decision="no_track".
- لا تُنشئ موسيقى جديدة.
- لا تستخدم أي مكتبة أخرى.

أخرج JSON فقط بالشكل التالي:
{
  "decision": "select_track" | "no_track",
  "selected": [
    {
      "track_id": "...",
      "usage": "intro" | "main",
      "loop": true
    }
  ],
  "mixing": {
    "music_volume_db": -18,
    "ducking_db": -12,
    "fade_in_sec": 2,
    "fade_out_sec": 3
  }
}`;

    // Only pass relevant track info to save context window
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
- language: ${context.language}
- tone: ${context.tone}
- voice_profile: ${context.voice_profile}
- duration_seconds: ${context.duration_seconds}
- script_summary: "${context.script_summary}"
- library_tracks: ${JSON.stringify(simplifiedTracks)}

المطلوب:
صيغة الإخراج (JSON):
{
  "decision": "select_track" | "no_track",
  "selected": [
    {
      "track_id": "…",
      "usage": "intro" | "main",
      "start_sec": 0,
      "end_sec": null,
      "loop": true
    }
  ],
  "mixing": {
    "music_volume_db": -18,
    "ducking_db": -12,
    "fade_in_sec": 2.5,
    "fade_out_sec": 3.0,
    "sidechain": true
  },
  "notes": "سبب الاختيار باختصار"
}`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            decision: { type: Type.STRING, enum: ["select_track", "no_track"] },
            selected: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        track_id: { type: Type.STRING },
                        usage: { type: Type.STRING, enum: ["intro", "main"] },
                        start_sec: { type: Type.NUMBER },
                        end_sec: { type: Type.NUMBER },
                        loop: { type: Type.BOOLEAN }
                    }
                }
            },
            mixing: {
                type: Type.OBJECT,
                properties: {
                    music_volume_db: { type: Type.NUMBER },
                    ducking_db: { type: Type.NUMBER },
                    fade_in_sec: { type: Type.NUMBER },
                    fade_out_sec: { type: Type.NUMBER },
                    sidechain: { type: Type.BOOLEAN }
                }
            },
            notes: { type: Type.STRING }
        },
        required: ["decision", "selected", "mixing", "notes"]
    };

    return generateStructuredContent<MusicDirectorResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 2000 }, undefined, apiKey);
};

// --- 0. Admin Planner Agent (Management: 0.8) ---

export const runAdminPlannerAgent = async (
    channel: Channel,
    pipelineType: ProductionLine,
    times: string[],
    dateStr: string,
    apiKey?: string
): Promise<{ data: AdminPlannerResult; usage: any }> => {
    
    // Construct strict System Instruction as per user request
    const systemInstruction = `أنت AdminPlanner داخل نظام أتمتة قناة يوتيوب.

مهمتك:
إنشاء خطة نشر يومية (Automation Plan) للقناة بدون إنتاج سكربت أو فيديو.

المطلوب:
- اقترح ${times.length} عناصر (items) مطابق لعدد الأوقات.
- لكل عنصر:
  - time
  - topic
  - title (قوي ومناسب للقناة)
  - angle (جملة واحدة)
  - duration (sec للشورت أو minutes للطويل)
  - visual provider (حسب خط الإنتاج)
- اجعل العناوين متنوعة وغير مكررة.
- لا تكتب سكربت.
- لا تذكر معلومات غير مؤكدة كحقائق.
- أخرج JSON فقط بدون أي نص إضافي.`;

    const channelProfile = {
        name: channel.name,
        language: channel.language,
        niche: channel.niche || 'General Interest',
        tone: channel.tone,
        audience: channel.audienceDescription || 'General Audience'
    };

    const prompt = `
المدخلات:
- channel_profile: ${JSON.stringify(channelProfile)}
- production_line: ${pipelineType}
- videos_per_day: ${times.length}
- times: ${JSON.stringify(times)}
- timezone: "Asia/Riyadh" (Default)
- constraints: ${pipelineType === 'Shorts' ? '{duration: 40-60 sec}' : '{duration: 8-15 min}'}
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

    return generateStructuredContent<AdminPlannerResult>(prompt, { temperature: 0.8, systemInstruction, schema, maxTokens: 4000 }, undefined, apiKey);
};


// --- 1. Strategy Agent (Creative: 0.7) ---

export const runStrategyAgent = async (
  channel: Channel,
  topic: string,
  options: { videoType: string; duration: DurationConfig; },
  apiKey?: string
): Promise<{ data: StrategyResult; usage: any }> => {
  
  // Backwards compatibility for min/max
  const targetMin = options.duration.target_minutes || Math.ceil(options.duration.target_value / 60) || 5;

  const styleGuard = `STYLE LOCK: Channel Tone: "${channel.tone}". Niche: "${channel.niche}". Audience: "${channel.audienceDescription}".`;
  const durationConstraint = `Target Duration: ${targetMin} minutes.
  CRITICAL: Adjust the scope of the idea to fit this duration exactly. 
  ${targetMin > 20 ? "For long videos, choose deep, complex topics requiring detailed analysis." : "For short videos, choose focused, singular topics."}`;

  const systemInstruction = `You are a StrategyDirector.
${styleGuard}
${durationConstraint}
Task: Choose ONE strong video idea and angle.
Rules:
- Output JSON only.
- Be concise.
- Focus on high retention (CTR/AVD).
- Do not use newlines in JSON strings.`;

  const prompt = `
Inputs:
- Topic: ${topic}
- Type: ${options.videoType}
- Language: ${channel.language}
- Target Duration: ${targetMin} min

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

  // Optimization: Increased to 8192 for deep outlines
  return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 8192 }, undefined, apiKey);
};

// --- 1.5 SHORTS: Hook Maker Agent (Highly Creative: 0.9) ---

export const runHookMakerAgent = async (
    channel: Channel,
    topic: string,
    apiKey?: string
): Promise<{ data: StrategyResult; usage: any }> => {
    
    const styleGuard = `STYLE LOCK: Channel Tone: "${channel.tone}". Language: "${channel.language}".`;
    
    const systemInstruction = `You are a HookMaker for Viral Shorts.
    ${styleGuard}
    Task: Create a killer hook and simple structure for a < 60s video.
    Rules:
    - The idea must be Explainable in 45 seconds.
    - Focus on visual storytelling.
    - Output must be valid JSON.`;
  
    const prompt = `Topic: ${topic}. 
    Create a Short Video Strategy.
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
  
    return generateStructuredContent<StrategyResult>(prompt, { temperature: 0.9, systemInstruction, schema, maxTokens: 2000 }, undefined, apiKey);
};

// --- 2. Structure Agent (Planning: 0.5) ---

export const runStructureAgent = async (outline: string[], duration: DurationConfig, apiKey?: string): Promise<{ data: StructureResult; usage: any }> => {
  const targetMin = duration.target_minutes || 5;
  const minChapters = Math.max(3, Math.floor(targetMin / 8));
  const maxChapters = Math.max(5, Math.ceil(targetMin / 5));

  const systemInstruction = `You are a StructureAgent.
Duration Goal: ${targetMin} minutes.
Rules:
- Divide into ${minChapters}-${maxChapters} chapters.
- Total duration must sum to approx ${targetMin * 60} seconds.
- Keep titles and objectives very short (max 10 words).
- Do not use newlines in JSON strings.`;

  const prompt = `Outline: ${JSON.stringify(outline)}.
  Required: Return 'chapters' array with title, objective, duration_seconds.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      chapters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objective: { type: Type.STRING },
            duration_seconds: { type: Type.NUMBER },
            break_points: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }
  };

  // Optimization: Increased to 4000
  return generateStructuredContent<StructureResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 4000 }, undefined, apiKey);
};

// --- 3. Script Builder Agent (Creative: 0.7) ---

export const runScriptBuilderAgent = async (
    chapters: Chapter[], 
    channel: Channel, 
    apiKey?: string
): Promise<{ data: ScriptResult; usage: any }> => {
  
  const styleGuard = `STYLE LOCK: Tone: ${channel.tone}. Language: ${channel.language}.`;
  
  const systemInstruction = `You are a ScriptBuilder.
${styleGuard}
Task: Write the full narrator script.
Rules:
- Write in ${channel.language}.
- Short, punchy sentences.
- NO visual directions in the script text.
- Match word count to duration_seconds (approx 130 words per minute).
- Do not use newlines inside JSON strings.`;

  const prompt = `Chapters: ${JSON.stringify(chapters)}. Write full script content for each chapter.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      script_final: { type: Type.STRING },
      chapters_content: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          }
        }
      }
    }
  };

  // Optimization: INCREASED to 8192 to prevent 'Unterminated string' errors on long scripts
  return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 8192 }, undefined, apiKey);
};

// --- 3.5 SHORTS: MicroScript Builder (Strict: 0.4) ---

export const runMicroScriptBuilderAgent = async (
    hook: string,
    outline: string[],
    durationSec: number,
    channel: Channel,
    apiKey?: string
): Promise<{ data: ScriptResult; usage: any }> => {
    
    // Avg speaking rate ~ 150 wpm = ~2.5 words/sec.
    // For 45s, approx 110 words max.
    const maxWords = Math.floor(durationSec * 2.3); 

    const systemInstruction = `You are a MicroScriptBuilder for Shorts.
    Duration Limit: ${durationSec} seconds (Max ~${maxWords} words).
    Language: ${channel.language}.
    Rules:
    - Start immediately with the Hook.
    - No fluff. Every word must add value.
    - Use simple, high-energy language.
    - Break into 4-6 mini-segments.`;

    const prompt = `Hook: "${hook}". 
    Outline: ${JSON.stringify(outline)}.
    Write a continuous script optimized for ${durationSec}s vertical video.`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          script_final: { type: Type.STRING },
          chapters_content: { // Reusing structure for compatibility
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING }, // Segment name
                content: { type: Type.STRING } // Segment text
              }
            }
          }
        }
    };

    return generateStructuredContent<ScriptResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 2000 }, undefined, apiKey);
};

// --- 4. Pacing Reviewer Agent (Decision/QC: 0.2) ---

export const runPacingReviewerAgent = async (script: string, apiKey?: string): Promise<{ data: PacingResult; usage: any }> => {
  const systemInstruction = `You are a PacingReviewer.
Task: Trim fluff by 10%. Keep it snappy.
Output JSON only.
- Do not use newlines in JSON strings.`;

  const prompt = `Script: ${script.substring(0, 10000)}`; // Truncate if insanely long to prevent error

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      refined_script: { type: Type.STRING },
      notes: { type: Type.ARRAY, items: { type: Type.STRING } },
      improvements: { type: Type.STRING }
    }
  };

  return generateStructuredContent<PacingResult>(prompt, { temperature: 0.2, systemInstruction, schema, maxTokens: 8192 }, undefined, apiKey);
};

// --- 5. Title Generator Agent (Creative: 0.7) ---

export const runTitleGeneratorAgent = async (idea: string, angle: string, language: string, apiKey?: string): Promise<{ data: TitleResult; usage: any }> => {
  const systemInstruction = `TitleGenerator.
Rules:
- High CTR.
- Language: ${language}.
- Max 60 chars.
- Generate 5 variations.
- Do not use newlines in JSON strings.`;

  const prompt = `Idea: ${idea}. Angle: ${angle}.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      titles: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['Curiosity', 'Emotional', 'Direct', 'Informational'] }
          }
        }
      }
    }
  };

  // Increased to 2000 to prevent 'Unterminated string' on arrays
  return generateStructuredContent<TitleResult>(prompt, { temperature: 0.7, systemInstruction, schema, maxTokens: 2000 }, undefined, apiKey);
};

// --- 6. Title Selector Agent (Decision: 0.2) ---

export const runTitleSelectorAgent = async (titles: TitleVariant[], channelStyle: string, apiKey?: string): Promise<{ data: TitleSelectionResult; usage: any }> => {
  const systemInstruction = `TitleSelector.
Style: ${channelStyle}.
Pick the best one for YouTube.`;

  const prompt = `Titles: ${JSON.stringify(titles.map(t => t.text))}.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      selected_title: { type: Type.STRING },
      backup_title: { type: Type.STRING },
      reasoning: { type: Type.STRING }
    },
    required: ["selected_title", "backup_title", "reasoning"]
  };

  // Increased tokens to 2000 to prevent early cut-off of reasoning
  return generateStructuredContent<TitleSelectionResult>(prompt, { temperature: 0.2, systemInstruction, schema, maxTokens: 2000 }, undefined, apiKey);
};

// --- 7. Scene Planner Agent (Planning: 0.5) ---

export const runScenePlannerAgent = async (script: string, visualStyle: string, apiKey?: string): Promise<{ data: ScenePlanResult; usage: any }> => {
  const systemInstruction = `ScenePlanner.
Style: ${visualStyle}.
Task: Create visual scenes from script.
Rules:
- One scene per ~10 seconds of script.
- Visual prompts must be descriptive English (for GenAI).
- No text inside images.
- Do not use newlines in JSON strings.`;

  const prompt = `Script: ${script}`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            scene_id: { type: Type.STRING },
            duration_seconds: { type: Type.NUMBER },
            objective: { type: Type.STRING },
            visual_prompt: { type: Type.STRING },
            mood: { type: Type.STRING },
            shot_type: { type: Type.STRING },
            narration_text: { type: Type.STRING }
          }
        }
      }
    }
  };

  // Optimization: Increased to 8192! This is critical for generating long lists of scenes without truncation.
  return generateStructuredContent<ScenePlanResult>(prompt, { temperature: 0.5, systemInstruction, schema, maxTokens: 8192 }, undefined, apiKey);
};

// --- Content Generation ---

export const generateSpeech = async (text: string, voiceName: string = 'Kore', apiKeyOverride?: string): Promise<Blob> => {
    const apiKey = getApiKey(apiKeyOverride);
    const ai = new GoogleGenAI({ apiKey });

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts", 
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
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
    });
};

export const generateImage = async (prompt: string, apiKeyOverride?: string): Promise<string> => {
    const apiKey = getApiKey(apiKeyOverride);
    const ai = new GoogleGenAI({ apiKey });

    return withRetry(async () => {
        // 1. Try Gemini 2.5 Flash Image first
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [{ text: prompt }]
                }
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

        // 2. Fallback to Imagen 3
        try {
            const response = await ai.models.generateImages({
                model: "imagen-3.0-generate-001",
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: "16:9",
                    outputMimeType: "image/jpeg"
                }
            });

            const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
            if (base64Data) {
                return `data:image/jpeg;base64,${base64Data}`;
            }
        } catch (e: any) {
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
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio 
            }
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
