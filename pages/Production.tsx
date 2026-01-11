
import React, { useState, useEffect } from 'react';
import { ProductionJob, JobStatus, AgentRole, ChannelType, DurationConfig, VisualConfig, StepControl, ManualInputs, ProductionStep, ProductionType } from '../types';
import { db } from '../services/storageService';
import { server } from '../services/serverOrchestrator'; // The "Server"
import { CheckCircle2, Circle, AlertCircle, Loader2, Play, Film, Video, Image as ImageIcon, Music, CheckSquare, Zap, Clock, Smartphone, MonitorPlay, FileText, Upload } from 'lucide-react';
import InlineCopilot from '../components/InlineCopilot';

interface ProductionProps {
  initialJobs?: ProductionJob[];
}

const StatusIcon = ({ status }: { status: JobStatus }) => {
  switch (status) {
    case JobStatus.COMPLETED: return <CheckCircle2 className="text-green-500" size={20} />;
    case JobStatus.RUNNING: return <Loader2 className="text-blue-500 animate-spin" size={20} />;
    case JobStatus.FAILED: return <AlertCircle className="text-red-500" size={20} />;
    case JobStatus.SKIPPED: return <CheckSquare className="text-slate-500" size={20} />;
    case JobStatus.PENDING: default: return <Circle className="text-slate-600" size={20} />;
  }
};

const Production: React.FC<ProductionProps> = () => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  // -- JOB CONFIGURATION FORM --
  const [productionType, setProductionType] = useState<ProductionType>('Long');
  const [newTopic, setNewTopic] = useState('');
  const [durationInput, setDurationInput] = useState<number>(10);
  
  // Source Material (New)
  const [sourceMaterial, setSourceMaterial] = useState('');
  
  // Visual Mode
  const [visualMode, setVisualMode] = useState<'images' | 'video'>('images');
  const [shortsProvider, setShortsProvider] = useState<'veo_3_1_fast' | 'veo_2'>('veo_3_1_fast');
  
  // Step Controls (Matrix)
  const [stepControl, setStepControl] = useState<StepControl>({
      title: 'agent', script: 'agent', scenes: 'agent', visuals: 'agent', voice: 'agent', music: 'auto', publish: 'manual'
  });

  const [manualTitle, setManualTitle] = useState('');
  const [manualScript, setManualScript] = useState('');

  // Update defaults
  useEffect(() => {
      if (productionType === 'Shorts') {
          setDurationInput(45);
          setVisualMode('video');
      } else {
          setDurationInput(10);
          setVisualMode('images');
      }
  }, [productionType]);

  // --- POLLING LOOP (Client polling Server) ---
  useEffect(() => {
      const fetchJobs = async () => {
          const data = await db.getJobs();
          // Simple sort by ID desc
          const sorted = data.sort((a, b) => {
              const timeA = parseInt(a.id.split('_')[1] || '0');
              const timeB = parseInt(b.id.split('_')[1] || '0');
              return timeB - timeA;
          });
          setJobs(sorted);
          if (sorted.length > 0 && !selectedJobId) {
              setSelectedJobId(sorted[0].id);
          }
          setLoadingData(false);
      };

      fetchJobs(); // Initial fetch
      const interval = setInterval(fetchJobs, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
  }, [selectedJobId]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type === "text/plain") {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) setSourceMaterial(ev.target.result as string);
          };
          reader.readAsText(file);
      } else {
          alert("حالياً ندعم الملفات النصية (.txt) فقط. يرجى نسخ المحتوى ولصقه إذا كان PDF.");
      }
  };

  // --- COPILOT ACTION HANDLER ---
  const handleCopilotAction = (action: string, payload: any) => {
      if (action === 'configure_job') {
          if (payload.topic) setNewTopic(payload.topic);
          if (payload.type) setProductionType(payload.type);
          if (payload.duration) setDurationInput(payload.duration);
          if (payload.visualMode) setVisualMode(payload.visualMode);
          if (payload.sourceNote) setSourceMaterial(prev => prev ? prev : `[Auto-Generated Notes from Link]:\n${payload.sourceNote}`);
          
          alert("تم ضبط إعدادات الفيديو بناءً على تحليل الرابط/الوصف.");
      }
  };

  const PRODUCTION_COPILOT_PROMPT = `You are a Video Production Copilot.
Your goal: Help the user configure a new job by "Reverse Engineering" their request.
If the user provides a YouTube Link or a description of a video style, analyze it (simulate analysis) and output a configuration JSON.

Trigger: When user says "Make a video like this [LINK]" or "Create a documentary about X like Channel Y".

Action: 'configure_job'
Payload: {
  "topic": "The inferred topic",
  "type": "Long" or "Shorts",
  "duration": number (minutes for long, seconds for shorts),
  "visualMode": "images" or "video" (based on complexity),
  "sourceNote": "A summary of the style/structure derived from the user's input to be used as source material."
}

Example: "Make a 60s short about space like this link..." -> type: Shorts, duration: 60, visualMode: video.`;

  // --- START JOB REQUEST ---
  const handleStartRequest = async () => {
    if (!newTopic) return;
    setIsRequesting(true);

    const isShorts = productionType === 'Shorts';
    
    // 1. Prepare Config Payload
    const durationConfig: DurationConfig = {
        mode: 'fixed',
        unit: isShorts ? 'seconds' : 'minutes',
        target_value: durationInput,
        target_minutes: isShorts ? 1 : durationInput
    };

    const visualConfig: VisualConfig = {
        mode: isShorts ? 'video' : (visualMode === 'video' ? 'video' : 'images'),
        provider: isShorts ? shortsProvider : (visualMode === 'video' ? 'veo_3_1_fast' : 'nano_banana'),
        fallback: isShorts ? 'veo_2' : 'images',
        quality: 'standard',
        aspectRatio: isShorts ? '9:16' : '16:9'
    };

    // 2. Define Pipeline (Client defines WHAT, Server defines HOW)
    const pipelineSteps: ProductionStep[] = [];
    if (isShorts) {
        pipelineSteps.push(
            { id: 'sh1', agentRole: AgentRole.HOOK_MAKER, name: '1. Viral Hook Strategy', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh2', agentRole: AgentRole.TITLE_OPTIMIZER, name: '2. Title Gen', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh3', agentRole: AgentRole.TITLE_SELECTOR, name: '3. Title Select', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh4', agentRole: AgentRole.MICRO_SCRIPT_BUILDER, name: '4. Micro Scripting', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh5', agentRole: AgentRole.PACING_REVIEWER, name: '5. Pacing Check', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh6', agentRole: AgentRole.SCENE_PLANNER, name: '6. Shot Planning', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh7', agentRole: AgentRole.VISUAL_PRODUCER, name: '7. Vertical Visuals', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh8', agentRole: AgentRole.VOICE_DIRECTOR, name: '8. Voiceover', status: JobStatus.PENDING, retryCount: 0 }
        );
        if (stepControl.music === 'auto') {
            pipelineSteps.push({ id: 'shM', agentRole: AgentRole.MUSIC_DIRECTOR, name: 'Music Selection', status: JobStatus.PENDING, retryCount: 0 });
        }
        pipelineSteps.push(
            { id: 'sh9', agentRole: AgentRole.EDITOR_ASSEMBLER, name: '9. Vertical Assembly', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh10', agentRole: AgentRole.QA_REVIEWER, name: '10. Shorts QA', status: JobStatus.PENDING, retryCount: 0 }
        );
    } else {
        // Long Form Pipeline Definition
        if (stepControl.title === 'agent') {
            pipelineSteps.push(
                { id: 's1', agentRole: AgentRole.STRATEGY_DIRECTOR, name: '1. Strategy', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's2', agentRole: AgentRole.TITLE_OPTIMIZER, name: '2. Title Gen', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's3', agentRole: AgentRole.TITLE_SELECTOR, name: '3. Title Select', status: JobStatus.PENDING, retryCount: 0 }
            );
        } else {
            pipelineSteps.push({ id: 'm1', agentRole: AgentRole.TITLE_SELECTOR, name: 'Manual Title', status: JobStatus.SKIPPED, outputSummary: 'Manual Input', retryCount: 0 });
        }

        if (stepControl.script === 'agent') {
            pipelineSteps.push(
                { id: 's4', agentRole: AgentRole.STRUCTURE_AGENT, name: '4. Structure', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's5', agentRole: AgentRole.SCRIPT_BUILDER, name: '5. Scripting', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's6', agentRole: AgentRole.PACING_REVIEWER, name: '6. Pacing', status: JobStatus.PENDING, retryCount: 0 }
            );
        } else {
             pipelineSteps.push({ id: 'm2', agentRole: AgentRole.PACING_REVIEWER, name: 'Manual Script', status: JobStatus.SKIPPED, outputSummary: 'Manual Input', retryCount: 0 });
        }

        pipelineSteps.push(
            { id: 's7', agentRole: AgentRole.SCENE_PLANNER, name: '7. Scene Plan', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's8', agentRole: AgentRole.VISUAL_PRODUCER, name: '8. Visuals', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's9', agentRole: AgentRole.VOICE_DIRECTOR, name: '9. Voiceover', status: JobStatus.PENDING, retryCount: 0 }
        );

        if (stepControl.music === 'auto') {
            pipelineSteps.push({ id: 'sM', agentRole: AgentRole.MUSIC_DIRECTOR, name: 'Music Selection', status: JobStatus.PENDING, retryCount: 0 });
        }

        pipelineSteps.push(
            { id: 's10', agentRole: AgentRole.EDITOR_ASSEMBLER, name: '10. Editing', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's11', agentRole: AgentRole.QA_REVIEWER, name: '11. QA', status: JobStatus.PENDING, retryCount: 0 }
        );
    }

    // 3. Send Request to Server
    try {
        const jobId = await server.startJob({
            title: stepControl.title === 'manual' ? manualTitle : newTopic,
            type: productionType,
            steps: pipelineSteps,
            durationConfig,
            visualConfig,
            stepControl,
            manualInputs: { 
                title: manualTitle, 
                script: manualScript,
                sourceMaterial: sourceMaterial // Pass uploaded content
            }
        });

        // UI Updates immediately
        setNewTopic('');
        setSourceMaterial('');
        setSelectedJobId(jobId);
    } catch (e: any) {
        alert("Server Error: " + e.message);
    } finally {
        setIsRequesting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6">
      {/* Job List & Config */}
      <div className="w-1/3 border-l border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h3 className="font-bold text-white mb-4">إنشاء مهمة (Send to Server)</h3>
          
          <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800 h-[600px] overflow-y-auto custom-scrollbar">
            {/* 1. Type */}
            <div>
                 <label className="text-xs text-slate-500 font-bold mb-1 block">Production Type</label>
                 <div className="flex bg-slate-900 rounded p-1 border border-slate-700 mb-3">
                    <button 
                        onClick={() => setProductionType('Long')} 
                        className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${productionType === 'Long' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                    >
                        <MonitorPlay size={12} /> Long Video
                    </button>
                    <button 
                         onClick={() => setProductionType('Shorts')} 
                         className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${productionType === 'Shorts' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                    >
                        <Smartphone size={12} /> Shorts (9:16)
                    </button>
                </div>

                <label className="text-xs text-slate-500 font-bold mb-1 block">Topic</label>
                <input 
                    type="text" 
                    placeholder="Enter video topic..." 
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                />
            </div>

            {/* Source Material Input (Long Form Only) */}
            {productionType === 'Long' && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs text-slate-500 font-bold block flex items-center gap-2">
                        <FileText size={12} /> مادة مصدرية (نص/قصة)
                    </label>
                    <div className="relative">
                        <textarea 
                            value={sourceMaterial}
                            onChange={(e) => setSourceMaterial(e.target.value)}
                            placeholder="الصق نص القصة أو المقالة هنا لاستخدامها كمصدر..."
                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none"
                        />
                        <div className="absolute bottom-2 left-2">
                            <input 
                                type="file" 
                                id="source-upload" 
                                className="hidden" 
                                accept=".txt" 
                                onChange={handleFileUpload} 
                            />
                            <label 
                                htmlFor="source-upload" 
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 py-1 rounded text-[10px] cursor-pointer transition border border-slate-700"
                            >
                                <Upload size={10} /> رفع ملف (.txt)
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Controls */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">Visuals</label>
                    <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                         {productionType === 'Shorts' ? (
                            <span className="text-[10px] text-purple-400 px-2 py-1">Locked: Video</span>
                         ) : (
                            <>
                                <button onClick={() => setVisualMode('images')} className={`flex-1 text-[10px] py-1 rounded ${visualMode === 'images' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Images</button>
                                <button onClick={() => setVisualMode('video')} className={`flex-1 text-[10px] py-1 rounded ${visualMode === 'video' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Veo</button>
                            </>
                         )}
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">Duration</label>
                    <input type="number" value={durationInput} onChange={e => setDurationInput(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center text-sm text-white"/>
                </div>
            </div>

            {/* 3. Inline Copilot for Reverse Engineering */}
            <div className="pt-2 border-t border-slate-800">
                <InlineCopilot 
                    title="Production Copilot"
                    subtitle="ضع رابط يوتيوب لنسخ الأسلوب"
                    placeholder="مثال: اصنع فيديو مثل هذا الرابط..."
                    systemPrompt={PRODUCTION_COPILOT_PROMPT}
                    onAction={handleCopilotAction}
                    compact
                />
            </div>

            <button 
                onClick={handleStartRequest}
                disabled={isRequesting || !newTopic}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                {isRequesting ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>}
                <span>Start Server Job</span>
            </button>
          </div>
        </div>
        
        {/* Jobs List (Read Only) */}
        <div className="overflow-y-auto flex-1 bg-slate-950/50">
          {loadingData ? (
             <div className="text-center p-4 text-slate-500 text-sm">جاري جلب البيانات من السيرفر...</div>
          ) : (
            jobs.map(job => (
                <div 
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition ${selectedJobId === job.id ? 'bg-slate-900 border-r-4 border-r-blue-500' : ''}`}
                >
                <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-slate-200 line-clamp-1">{job.title}</h4>
                    <StatusIcon status={job.status} />
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-2">
                        {job.type === 'Shorts' ? (
                            <span className="text-[10px] bg-purple-900/30 text-purple-400 border border-purple-800 px-1 rounded flex items-center gap-1">
                                <Smartphone size={8} /> Shorts
                            </span>
                        ) : (
                            <span className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800 px-1 rounded flex items-center gap-1">
                                <MonitorPlay size={8} /> Long
                            </span>
                        )}
                        {job.manualInputs?.sourceMaterial && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1 rounded flex items-center gap-1">
                                <FileText size={8} /> Source
                            </span>
                        )}
                    </div>
                    {/* Progress Bar based on completed steps */}
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${job.status === JobStatus.FAILED ? 'bg-red-500' : 'bg-green-500'}`} 
                            style={{ width: `${(job.steps.filter(s => s.status === JobStatus.COMPLETED).length / job.steps.length) * 100}%` }}
                        ></div>
                    </div>
                </div>
                </div>
            ))
          )}
        </div>
      </div>

      {/* Pipeline View (Read Only) */}
      <div className="w-2/3 bg-slate-950 flex flex-col">
        {selectedJob ? (
          <>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {selectedJob.title}
                    {selectedJob.status === JobStatus.RUNNING && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white animate-pulse">Processing on Server...</span>}
                </h2>
                <div className="flex gap-4 mt-1 text-sm text-slate-400">
                    <span className="font-mono">ID: {selectedJob.id}</span>
                    {selectedJob.durationConfig && (
                        <span className="flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 rounded-full text-xs">
                            <Clock size={12} /> {selectedJob.durationConfig.target_value} {selectedJob.durationConfig.unit}
                        </span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="relative">
                <div className="absolute top-4 bottom-4 right-5 w-0.5 bg-slate-800"></div>

                <div className="space-y-8">
                  {selectedJob.steps.map((step, idx) => {
                    const isCurrent = idx === selectedJob.currentStepIndex;

                    return (
                      <div key={step.id} className="relative flex gap-6 pr-2">
                        {/* Status Bubble */}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-slate-950 transition-colors ${
                          isCurrent ? 'border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' :
                          step.status === JobStatus.COMPLETED ? 'border-green-500 text-green-500 bg-green-500/10' :
                          step.status === JobStatus.FAILED ? 'border-red-500 text-red-500' :
                          'border-slate-700 text-slate-700'
                        }`}>
                          <StatusIcon status={step.status} />
                        </div>

                        {/* Content */}
                        <div className={`flex-1 rounded-xl border p-5 transition-all ${
                          isCurrent ? 'bg-slate-900 border-blue-500/30' : 
                          'bg-slate-900/50 border-slate-800'
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className={`font-bold text-lg ${isCurrent ? 'text-blue-400' : 'text-slate-300'}`}>{step.name}</h4>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Server Agent: {step.agentRole}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {step.tokenUsage && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                        <Zap size={10} className="text-amber-500" />
                                        <span>{step.tokenUsage.total.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                          </div>

                          {/* Artifacts Display (Fetching from Server DB) */}
                          <div className="mt-4 space-y-4">
                              {/* Only show artifacts if step completed */}
                              {step.status === JobStatus.COMPLETED && (
                                  <>
                                      {/* Titles */}
                                      {(step.agentRole === AgentRole.TITLE_SELECTOR || step.agentRole === AgentRole.HOOK_MAKER) && selectedJob.artifacts.selectedTitle && (
                                          <div className="bg-blue-900/10 border border-blue-900/50 p-4 rounded-lg">
                                              <p className="text-sm font-bold text-blue-400 mb-1">Generated Title</p>
                                              <h3 className="text-xl font-bold text-white">{selectedJob.artifacts.selectedTitle.selected_title}</h3>
                                          </div>
                                      )}
                                      {/* Script */}
                                      {(step.agentRole === AgentRole.PACING_REVIEWER || step.agentRole === AgentRole.MICRO_SCRIPT_BUILDER) && selectedJob.artifacts.refinedScript && (
                                          <div className="bg-slate-950 p-4 rounded border border-slate-800 text-slate-400 text-sm max-h-32 overflow-y-auto">
                                              {selectedJob.artifacts.refinedScript}
                                          </div>
                                      )}
                                      {/* Visuals */}
                                      {step.agentRole === AgentRole.VISUAL_PRODUCER && selectedJob.artifacts.scenesWithImages && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {(selectedJob.artifacts.scenesWithImages as any[]).map((s, i) => (
                                                <div key={i} className={`bg-slate-950 rounded overflow-hidden relative group border border-slate-800 ${selectedJob.type === 'Shorts' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                                                    {s.mediaType === 'video' ? (
                                                        <video src={s.generatedVideoUrl} className="w-full h-full object-cover" muted autoPlay loop />
                                                    ) : (
                                                        <img src={s.generatedImageUrl} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                      )}
                                      {/* Final Video */}
                                      {step.agentRole === AgentRole.EDITOR_ASSEMBLER && selectedJob.artifacts.finalVideoUrl && (
                                          <div className="mt-4 flex justify-center">
                                              <video controls className={`rounded-lg bg-black border border-slate-700 ${selectedJob.type === 'Shorts' ? 'w-1/3' : 'w-full'}`} src={selectedJob.artifacts.finalVideoUrl} />
                                          </div>
                                      )}
                                  </>
                              )}
                          </div>

                           {step.errorMessage && (
                            <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm">
                                Server Error: {step.errorMessage}
                            </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col">
            <Film size={48} className="mb-4 opacity-20" />
            <p>اختر مهمة لعرض حالتها في السيرفر</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Production;
