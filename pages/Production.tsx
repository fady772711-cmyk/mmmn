
import React, { useState, useEffect } from 'react';
import { ProductionJob, JobStatus, AgentRole, ProductionType, Channel, ProductionStep } from '../types';
import { server } from '../services/serverOrchestrator';
import { db } from '../services/storageService';
import { assembleVideo } from '../services/videoAssembler'; 
import { 
    CheckCircle2, Circle, AlertCircle, Loader2, Play, 
    MonitorPlay, Smartphone, Zap, Clock, DollarSign, 
    ChevronRight, Type as TypeIcon, Music, Mic2, Sliders, Volume2, Film,
    Eye, AlignLeft, Activity, ImageIcon, FileText, Download
} from 'lucide-react';

// --- Components ---

interface StepCardProps {
    step: ProductionStep;
    index: number;
    job: ProductionJob;
}

const StepCard: React.FC<StepCardProps> = ({ step, index, job }) => {
    const isActive = step.status === JobStatus.RUNNING;
    const isDone = step.status === JobStatus.COMPLETED;
    const [rendering, setRendering] = useState(false);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    
    // --- Artifact Extraction ---
    const titleArtifact = step.artifacts?.find(a => a.label.includes('Selected Title') || a.label.includes('Hook'));
    const scriptArtifact = step.artifacts?.find(a => a.label.includes('Script') && a.type === 'text');
    const imageArtifacts = step.artifacts?.filter(a => a.type === 'image') || [];
    const audioArtifact = step.artifacts?.find(a => a.type === 'audio');
    const mixArtifact = step.artifacts?.find(a => a.type === 'mix_config');
    const mixData = mixArtifact && mixArtifact.content ? JSON.parse(mixArtifact.content) : null;

    // --- RENDER LOGIC FOR ASSEMBLER ---
    const handleRender = async () => {
        setRendering(true);
        try {
            // 1. Gather Assets from previous steps
            const visualsStep = job.steps.find(s => s.agentRole === 'VisualProducer');
            const voiceStep = job.steps.find(s => s.agentRole === 'VoiceDirector');
            const musicStep = job.steps.find(s => s.agentRole === 'MusicDirector');

            // Parse Scenes
            const scenesArtifact = visualsStep?.artifacts?.find(a => a.label.includes('JSON'));
            const scenes = scenesArtifact ? JSON.parse(scenesArtifact.content || '[]') : [];

            // Get Audio URLs
            const voiceUrl = voiceStep?.artifacts?.find(a => a.type === 'audio')?.url;
            const musicConfig = musicStep?.artifacts?.find(a => a.type === 'mix_config');
            const musicUrl = musicConfig && musicConfig.content ? JSON.parse(musicConfig.content).trackUrl : null;

            if (scenes.length === 0) throw new Error("No scenes found to render");

            // 2. Call Assembler
            const blob = await assembleVideo(
                scenes,
                job.type === 'Shorts' ? '9:16' : '16:9',
                voiceUrl,
                musicUrl,
                -15 // Ducking level
            );

            // 3. Show Result
            const url = URL.createObjectURL(blob);
            setFinalVideoUrl(url);

        } catch (e: any) {
            alert("Rendering Failed: " + e.message);
            console.error(e);
        } finally {
            setRendering(false);
        }
    };

    return (
        <div className={`relative bg-slate-900 border rounded-xl p-6 mb-6 transition-all duration-300 group ${
            isActive ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30' : 
            isDone ? 'border-slate-800 opacity-100 hover:border-slate-700' : 'border-slate-800 opacity-60'
        }`}>
            {/* Header Section */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isDone ? 'border-green-500 bg-green-500/10 text-green-500' :
                        isActive ? 'border-blue-500 bg-blue-500/10 text-blue-500 animate-pulse' :
                        'border-slate-700 bg-slate-800 text-slate-500'
                    }`}>
                        {isDone ? <CheckCircle2 size={20} /> : 
                         isActive ? <Loader2 size={20} className="animate-spin" /> : 
                         <span className="font-mono text-xs">{index + 1}</span>}
                    </div>

                    <div>
                        <h3 className={`text-lg font-bold ${isActive ? 'text-blue-400' : 'text-slate-200'}`}>
                            {step.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2">
                            {step.agentRole.replace('Director', '').replace('Builder', '').replace('Producer', '')} AGENT
                            {step.tokenUsage && <span className="text-amber-600">• {step.tokenUsage.total} tokens</span>}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- RICH CONTENT AREA (THE ARTIFACTS) --- */}
            
            {/* 1. TITLE / HOOK DISPLAY */}
            {titleArtifact && (
                <div className="mt-2 bg-gradient-to-r from-blue-900/20 to-transparent border-r-4 border-blue-500 p-4 rounded-l-lg animate-in fade-in slide-in-from-right-4">
                    <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">العنوان المختار (Title/Hook)</div>
                    <div className="text-xl font-bold text-white leading-tight">
                        "{titleArtifact.content}"
                    </div>
                </div>
            )}

            {/* 2. SCRIPT DISPLAY */}
            {scriptArtifact && (
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <FileText size={14} className="text-slate-500" />
                        <span className="font-bold">النص المولد (Generated Script)</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 font-serif leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar shadow-inner text-right" dir="rtl">
                        {scriptArtifact.content}
                    </div>
                </div>
            )}

            {/* 3. VISUALS (IMAGES GRID) */}
            {imageArtifacts.length > 0 && (
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <ImageIcon size={14} className="text-pink-500" />
                        <span className="font-bold">المشاهد المولدة (Generated Scenes)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {imageArtifacts.map((img, i) => (
                            <div key={i} className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                                <img src={img.url} alt={`Scene ${i}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500 hover:scale-110" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white p-1 text-center backdrop-blur-sm">
                                    Scene {i + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. VOICE / AUDIO PLAYER */}
            {audioArtifact && (
                <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-4 animate-in fade-in">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                        <Mic2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">التعليق الصوتي (Voiceover)</div>
                        <audio controls src={audioArtifact.url} className="w-full h-8 opacity-80 hover:opacity-100 transition" />
                    </div>
                </div>
            )}

            {/* 5. MUSIC MIXING DISPLAY */}
            {mixData && (
                <div className="mt-4 bg-purple-900/10 border border-purple-900/30 rounded-lg p-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-3 border-b border-purple-900/30 pb-2">
                        <div className="flex items-center gap-2">
                            <Music size={16} className="text-purple-400" />
                            <span className="text-xs font-bold text-purple-300">الموسيقى المختارة (Backing Track)</span>
                        </div>
                        <span className="text-[10px] text-white bg-purple-900/50 px-2 py-0.5 rounded">{mixData.bpm} BPM</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-sm text-white font-bold">{mixData.track}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{mixData.mood}</div>
                        </div>
                        <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                            <span className="bg-slate-900 px-2 py-1 rounded">Ducking: {mixData.mix.ducking}</span>
                            <span className="bg-slate-900 px-2 py-1 rounded">Vol: {mixData.mix.music_volume_db || '-18'}dB</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. ASSEMBLY / FINAL VIDEO */}
            {step.agentRole === 'EditorAssembler' && isDone && (
                <div className="mt-6 border-t border-slate-800 pt-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                        <Film size={14} className="text-red-500" />
                        <span className="font-bold">الدمج النهائي (Final Assembly)</span>
                    </div>
                    
                    {!finalVideoUrl ? (
                        <button 
                            onClick={handleRender} 
                            disabled={rendering}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition shadow-lg group-hover:shadow-blue-900/10"
                        >
                            {rendering ? <Loader2 className="animate-spin text-blue-500" /> : <Play fill="currentColor" className="text-blue-500" />}
                            <span>بناء ومعاينة الفيديو (Render Video)</span>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl">
                                <video src={finalVideoUrl} controls autoPlay className="w-full max-h-[400px]" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Render Complete
                                </span>
                                <a 
                                    href={finalVideoUrl} 
                                    download={`video_${job.id}.webm`}
                                    className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition"
                                >
                                    <Download size={14} /> تحميل الفيديو
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Fallback Summary */}
            {!titleArtifact && !scriptArtifact && imageArtifacts.length === 0 && !audioArtifact && !mixData && !finalVideoUrl && step.outputSummary && step.agentRole !== 'EditorAssembler' && (
                <div className="mt-3 text-xs text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-800/50 inline-block">
                    {step.outputSummary}
                </div>
            )}
        </div>
    );
};

const Production: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // Form State
  const [channelId, setChannelId] = useState('');
  const [prodType, setProdType] = useState<ProductionType>('Long');
  const [topic, setTopic] = useState('');
  const [videoType, setVideoType] = useState('قصصي (Story)');
  const [llmModel, setLlmModel] = useState('Gemini 2.0 Flash');
  const [duration, setDuration] = useState(10);
  const [visualMode, setVisualMode] = useState('Images');
  const [musicMode, setMusicMode] = useState('Auto Mix');
  const [voiceMode, setVoiceMode] = useState('وكيل'); 
  const [textOverlay, setTextOverlay] = useState('تشغيل');
  
  // Style Settings
  const [textStyle, setTextStyle] = useState('Cinematic');
  const [textLines, setTextLines] = useState(2);
  const [textSize, setTextSize] = useState('Large');

  useEffect(() => {
      const init = async () => {
          const chans = await db.getChannels();
          setChannels(chans);
          if (chans.length > 0) setChannelId(chans[0].id);
      };
      init();

      // Poll for active job
      const poll = async () => {
          try {
              const response = await fetch('/api/jobs');
              if (response.ok) {
                  const data = await response.json();
                  if (data.length > 0) {
                      const latest = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                      setSelectedJob(latest);
                  }
              }
          } catch (e) { console.error(e); }
      };
      poll();
      const interval = setInterval(poll, 2000);
      return () => clearInterval(interval);
  }, []);

  const handleStartRun = async (overrideTopic?: string) => {
      const finalTopic = overrideTopic || topic;
      if (!finalTopic) return alert("Please enter a topic");
      
      setIsRequesting(true);
      const payload: Partial<ProductionJob> = {
          title: finalTopic,
          type: prodType,
          channelId,
          videoType,
          llmModel,
          durationConfig: { mode: 'fixed', unit: 'minutes', target_value: duration },
          visualConfig: { 
              mode: visualMode === 'Images' ? 'images' : 'video',
              provider: 'nano_banana',
              fallback: 'images',
              quality: 'standard',
              aspectRatio: prodType === 'Shorts' ? '9:16' : '16:9',
              textOverlay: { 
                  enabled: textOverlay === 'تشغيل',
                  style: textStyle as any,
                  lines: textLines as any,
                  size: textSize as any
              }
          },
          musicMode: musicMode === 'Auto Mix' ? 'Auto Mix' : 'Off',
          voiceMode: voiceMode === 'وكيل' ? 'Agent' : 'Auto'
      };

      try {
          await server.startJob(payload);
          setTopic('');
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setIsRequesting(false);
      }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 bg-slate-950 font-sans text-slate-200 overflow-hidden" dir="rtl">
        
        {/* RIGHT SIDE: Production Control Form */}
        <div className="w-[420px] bg-slate-900/50 border-l border-slate-800 flex flex-col z-10 shadow-2xl h-full overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white mb-1">إنشاء مهمة جديدة (Production Control)</h2>
                <p className="text-xs text-slate-500">تهيئة إعدادات الفيديو الجديد</p>
            </div>

            <div className="p-6 space-y-5">
                {/* Channel Selector */}
                <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2 text-right">Channel</label>
                    <select 
                        value={channelId} 
                        onChange={e => setChannelId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none text-right"
                    >
                        {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.language})</option>)}
                    </select>
                </div>

                {/* Production Type Toggles */}
                <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2 text-right">Production Type</label>
                    <div className="flex bg-slate-950 rounded-lg border border-slate-700 p-1">
                        <button 
                            onClick={() => setProdType('Shorts')}
                            className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition ${prodType === 'Shorts' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Shorts (9:16) <Smartphone size={14} />
                        </button>
                        <button 
                            onClick={() => setProdType('Long')}
                            className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition ${prodType === 'Long' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Long Video <MonitorPlay size={14} />
                        </button>
                    </div>
                </div>

                {/* Topic Input */}
                <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2 text-right">1. الموضوع (Topic)</label>
                    <input 
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="عن ماذا يتحدث الفيديو؟"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none text-right placeholder-slate-600"
                    />
                </div>

                {/* Video Type & Model */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-right">Video Type</label>
                        <select 
                            value={videoType} onChange={e => setVideoType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white text-right outline-none"
                        >
                            <option>قصصي (Story)</option>
                            <option>معلوماتي (Info)</option>
                            <option>إخباري (News)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-right">LLM Model</label>
                        <select 
                            value={llmModel} onChange={e => setLlmModel(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white text-right outline-none"
                        >
                            <option>Gemini 2.0 Flash</option>
                            <option>Gemini 3.0 Pro</option>
                        </select>
                    </div>
                </div>

                {/* Duration & Visual Mode Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-center">Duration (min)</label>
                        <div className="bg-slate-950 border border-slate-700 rounded-lg p-2 flex items-center justify-between">
                            <Clock size={16} className="text-slate-500 ml-2" />
                            <input 
                                type="number" min="1" max="60"
                                value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                                className="bg-transparent w-full text-center text-white outline-none font-mono"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-center">Visual Mode</label>
                        <div className="flex bg-slate-950 rounded-lg border border-slate-700 overflow-hidden h-[38px]">
                            <button 
                                onClick={() => setVisualMode('Veo')}
                                className={`flex-1 text-xs font-bold transition ${visualMode === 'Veo' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >Veo</button>
                            <div className="w-px bg-slate-700"></div>
                            <button 
                                onClick={() => setVisualMode('Images')}
                                className={`flex-1 text-xs font-bold transition ${visualMode === 'Images' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >Images</button>
                        </div>
                    </div>
                </div>

                {/* Music & Voice Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-right">Music Director</label>
                        <div className="flex bg-slate-950 rounded-lg border border-slate-700 overflow-hidden h-[38px]">
                            <button onClick={() => setMusicMode('Off')} className={`flex-1 text-xs font-bold ${musicMode === 'Off' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Off</button>
                            <div className="w-px bg-slate-700"></div>
                            <button onClick={() => setMusicMode('Auto Mix')} className={`flex-1 text-xs font-bold ${musicMode === 'Auto Mix' ? 'bg-green-600 text-white' : 'text-slate-500'}`}>Auto Mix</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 font-bold block mb-2 text-right">Voice Mode</label>
                        <div className="flex bg-slate-950 rounded-lg border border-slate-700 overflow-hidden h-[38px]">
                            <button onClick={() => setVoiceMode('تلقائي')} className={`flex-1 text-xs font-bold ${voiceMode === 'تلقائي' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>تلقائي</button>
                            <div className="w-px bg-slate-700"></div>
                            <button onClick={() => setVoiceMode('وكيل')} className={`flex-1 text-xs font-bold ${voiceMode === 'وكيل' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>وكيل</button>
                        </div>
                    </div>
                </div>

                {/* Text Overlay Section */}
                <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs text-slate-500 font-bold block text-right">إظهار النص (Text Overlay)</label>
                        <div className="flex bg-slate-950 rounded border border-slate-700 h-7 w-32">
                            <button onClick={() => setTextOverlay('إيقاف')} className={`flex-1 text-[10px] font-bold ${textOverlay === 'إيقاف' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>إيقاف</button>
                            <button onClick={() => setTextOverlay('تشغيل')} className={`flex-1 text-[10px] font-bold ${textOverlay === 'تشغيل' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>تشغيل</button>
                        </div>
                    </div>
                    
                    {textOverlay === 'تشغيل' && (
                        <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1 text-center">النمط</label>
                                <select value={textStyle} onChange={e => setTextStyle(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white text-center"><option>Cinematic</option><option>Bold</option><option>Minimal</option></select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1 text-center">عدد السطور</label>
                                <select value={textLines} onChange={e => setTextLines(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white text-center"><option>1</option><option>2</option><option>3</option></select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1 text-center">حجم النص</label>
                                <select value={textSize} onChange={e => setTextSize(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white text-center"><option>Small</option><option>Medium</option><option>Large</option></select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-6 mt-auto">
                    <button 
                        onClick={() => handleStartRun()}
                        disabled={isRequesting}
                        className="w-full bg-blue-700 hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRequesting ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
                        Start Production Run ▷
                    </button>
                </div>
            </div>
        </div>

        {/* LEFT SIDE: Active Job Monitor (Timeline) */}
        <div className="flex-1 bg-slate-950 relative flex flex-col">
            {selectedJob ? (
                <>
                    {/* Header Info */}
                    <div className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/20 backdrop-blur-sm z-10">
                        <div className="flex items-center gap-4">
                            <button className="bg-slate-800 border border-slate-700 text-slate-400 px-3 py-1.5 rounded text-xs font-bold hover:text-white transition">
                                عرض السجلات
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-blue-900/30">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-xs text-blue-400 font-bold">Processing on Server</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                                <Clock size={14} />
                                <span>{selectedJob.durationConfig?.target_value || 10} minutes</span>
                            </div>
                            <div className="text-slate-600 text-xs font-mono">
                                ID: {selectedJob.id}
                            </div>
                        </div>
                    </div>

                    {/* Content: Timeline Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                        <div className="max-w-4xl mx-auto space-y-0 relative">
                            
                            {/* Vertical Line */}
                            <div className="absolute top-4 bottom-10 right-[27px] w-0.5 bg-slate-800 z-0"></div>

                            {/* Steps */}
                            {selectedJob.steps.map((step, idx) => (
                                <StepCard key={step.id} step={step} index={idx} job={selectedJob} />
                            ))}
                            
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-30">
                    <MonitorPlay size={80} className="mb-6" />
                    <p className="text-2xl font-bold">System Idle</p>
                    <p className="text-sm">Waiting for production run...</p>
                </div>
            )}
        </div>

    </div>
  );
};

export default Production;
