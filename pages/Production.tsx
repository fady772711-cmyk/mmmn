
import React, { useState, useEffect } from 'react';
import { ProductionJob, JobStatus, AgentRole, ChannelType, DurationConfig, VisualConfig, StepControl, ManualInputs, ProductionStep, ProductionType } from '../types';
import { MOCK_JOBS, MOCK_CHANNELS } from '../services/mockData';
import { AgentRegistry } from '../services/agentRegistry';
import { db } from '../services/storageService';
import { CheckCircle2, Circle, AlertCircle, Loader2, Play, Film, Video, Image as ImageIcon, Music, CheckSquare, Zap, Clock, Settings2, FileText, Type, Smartphone, MonitorPlay } from 'lucide-react';

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

const Production: React.FC<ProductionProps> = ({ initialJobs = [] }) => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // -- JOB CONFIGURATION STATE --
  const [productionType, setProductionType] = useState<ProductionType>('Long');
  const [newTopic, setNewTopic] = useState('');
  const [videoType, setVideoType] = useState<string>(ChannelType.STORY);
  const [durationInput, setDurationInput] = useState<number>(10); // Represents Minutes (Long) or Seconds (Short)
  
  // Visual Mode
  const [visualMode, setVisualMode] = useState<'images' | 'video'>('images');
  // Shorts Provider Selection
  const [shortsProvider, setShortsProvider] = useState<'veo_3_1_fast' | 'veo_2'>('veo_3_1_fast');
  
  // Step Controls (Matrix)
  const [stepControl, setStepControl] = useState<StepControl>({
      title: 'agent',
      script: 'agent',
      scenes: 'agent',
      visuals: 'agent', // Always agent for now
      voice: 'agent', // Always agent
      music: 'auto', // New: Auto Music
      publish: 'manual'
  });

  // Manual Inputs
  const [manualTitle, setManualTitle] = useState('');
  const [manualScript, setManualScript] = useState('');
  const [manualScenesJSON, setManualScenesJSON] = useState('');

  // Update defaults when switching production type
  useEffect(() => {
      if (productionType === 'Shorts') {
          setDurationInput(45); // Default 45 seconds
          setVisualMode('video'); // Shorts implies video usually
      } else {
          setDurationInput(10); // Default 10 minutes
          setVisualMode('images');
      }
  }, [productionType]);

  // Load jobs from Storage on Mount
  useEffect(() => {
    const load = async () => {
        setLoading(true);
        const storedJobs = await db.getJobs();
        setJobs(storedJobs);
        if (storedJobs.length > 0 && !selectedJobId) {
            setSelectedJobId(storedJobs[0].id);
        }
        setLoading(false);
    };
    load();
  }, []);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const handleCreateJob = async () => {
    // Basic Validation
    if (!newTopic) return;
    if (stepControl.title === 'manual' && !manualTitle) {
        alert("الرجاء إدخال العنوان يدوياً");
        return;
    }
    if (stepControl.script === 'manual' && !manualScript) {
        alert("الرجاء إدخال السكربت يدوياً");
        return;
    }

    setIsGenerating(true);

    const channel = MOCK_CHANNELS[0]; 
    const isShorts = productionType === 'Shorts';
    
    // Configurations
    const durationConfig: DurationConfig = {
        mode: 'fixed',
        unit: isShorts ? 'seconds' : 'minutes',
        target_value: durationInput,
        min_value: durationInput - (isShorts ? 5 : 1),
        max_value: durationInput + (isShorts ? 5 : 1),
        // Legacy fields mapping
        target_minutes: isShorts ? 1 : durationInput
    };

    const visualConfig: VisualConfig = {
        mode: isShorts ? 'video' : (visualMode === 'video' ? 'video' : 'images'),
        provider: isShorts ? shortsProvider : (visualMode === 'video' ? 'veo_3_1_fast' : 'nano_banana'),
        fallback: isShorts ? 'veo_2' : 'images',
        quality: 'standard',
        aspectRatio: isShorts ? '9:16' : '16:9'
    };

    const manualInputs: ManualInputs = {
        title: manualTitle,
        script: manualScript,
        scenePlanJSON: manualScenesJSON
    };

    // --- PIPELINE CONSTRUCTION ---
    const pipelineSteps: ProductionStep[] = [];
    
    if (isShorts) {
        // --- SHORTS PIPELINE ---
        pipelineSteps.push(
            { id: 'sh1', agentRole: AgentRole.HOOK_MAKER, name: '1. Viral Hook Strategy', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh2', agentRole: AgentRole.TITLE_OPTIMIZER, name: '2. Title Gen', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh3', agentRole: AgentRole.TITLE_SELECTOR, name: '3. Title Select', status: JobStatus.PENDING, retryCount: 0 }
        );

        pipelineSteps.push(
            { id: 'sh4', agentRole: AgentRole.MICRO_SCRIPT_BUILDER, name: '4. Micro Scripting', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh5', agentRole: AgentRole.PACING_REVIEWER, name: '5. Pacing Check', status: JobStatus.PENDING, retryCount: 0 }
        );

        pipelineSteps.push(
            { id: 'sh6', agentRole: AgentRole.SCENE_PLANNER, name: '6. Shot Planning', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh7', agentRole: AgentRole.VISUAL_PRODUCER, name: '7. Vertical Visuals', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh8', agentRole: AgentRole.VOICE_DIRECTOR, name: '8. Voiceover', status: JobStatus.PENDING, retryCount: 0 }
        );

        // Music Step Check
        if (stepControl.music === 'auto') {
            pipelineSteps.push({ id: 'shM', agentRole: AgentRole.MUSIC_DIRECTOR, name: 'Music Selection', status: JobStatus.PENDING, retryCount: 0 });
        }

        pipelineSteps.push(
            { id: 'sh9', agentRole: AgentRole.EDITOR_ASSEMBLER, name: '9. Vertical Assembly', status: JobStatus.PENDING, retryCount: 0 },
            { id: 'sh10', agentRole: AgentRole.QA_REVIEWER, name: '10. Shorts QA', status: JobStatus.PENDING, retryCount: 0 }
        );

    } else {
        // --- LONG VIDEO PIPELINE ---
        if (stepControl.title === 'agent') {
            pipelineSteps.push(
                { id: 's1', agentRole: AgentRole.STRATEGY_DIRECTOR, name: '1. Strategy', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's2', agentRole: AgentRole.TITLE_OPTIMIZER, name: '2. Title Gen', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's3', agentRole: AgentRole.TITLE_SELECTOR, name: '3. Title Select', status: JobStatus.PENDING, retryCount: 0 }
            );
        } else {
            pipelineSteps.push({ id: 'm1', agentRole: AgentRole.TITLE_SELECTOR, name: 'Manual Title Input', status: JobStatus.SKIPPED, outputSummary: 'تم إدخال العنوان يدوياً', retryCount: 0 });
        }

        if (stepControl.script === 'agent') {
            pipelineSteps.push(
                { id: 's4', agentRole: AgentRole.STRUCTURE_AGENT, name: '4. Structure', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's5', agentRole: AgentRole.SCRIPT_BUILDER, name: '5. Scripting', status: JobStatus.PENDING, retryCount: 0 },
                { id: 's6', agentRole: AgentRole.PACING_REVIEWER, name: '6. Pacing', status: JobStatus.PENDING, retryCount: 0 }
            );
        } else {
            pipelineSteps.push({ id: 'm2', agentRole: AgentRole.PACING_REVIEWER, name: 'Manual Script Input', status: JobStatus.SKIPPED, outputSummary: 'تم إدخال السكربت يدوياً', retryCount: 0 });
        }

        if (stepControl.scenes === 'agent') {
            pipelineSteps.push({ id: 's7', agentRole: AgentRole.SCENE_PLANNER, name: '7. Scene Plan', status: JobStatus.PENDING, retryCount: 0 });
        } else {
            pipelineSteps.push({ id: 'm3', agentRole: AgentRole.SCENE_PLANNER, name: 'Manual Scene Plan', status: JobStatus.SKIPPED, outputSummary: 'تخطيط يدوي (JSON)', retryCount: 0 });
        }

        pipelineSteps.push(
            { id: 's8', agentRole: AgentRole.VISUAL_PRODUCER, name: '8. Visuals', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's9', agentRole: AgentRole.VOICE_DIRECTOR, name: '9. Voiceover', status: JobStatus.PENDING, retryCount: 0 }
        );

        // Music Step Check
        if (stepControl.music === 'auto') {
            pipelineSteps.push({ id: 'sM', agentRole: AgentRole.MUSIC_DIRECTOR, name: 'Music Selection', status: JobStatus.PENDING, retryCount: 0 });
        }

        pipelineSteps.push(
            { id: 's10', agentRole: AgentRole.EDITOR_ASSEMBLER, name: '10. Editing', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's11', agentRole: AgentRole.QA_REVIEWER, name: '11. QA', status: JobStatus.PENDING, retryCount: 0 }
        );
    }

    const newJob: ProductionJob = {
      id: `job_${Date.now()}`,
      runId: 'manual_run',
      title: stepControl.title === 'manual' ? manualTitle : newTopic,
      type: productionType,
      currentStepIndex: 0,
      status: JobStatus.RUNNING,
      steps: pipelineSteps,
      artifacts: {
          // Pre-fill artifacts if manual
          selectedTitle: stepControl.title === 'manual' ? { selected_title: manualTitle, reasoning: 'Manual Input' } : undefined,
          refinedScript: stepControl.script === 'manual' ? { refined_script: manualScript } : undefined,
      },
      logs: [],
      durationConfig,
      visualConfig,
      stepControl,
      manualInputs
    };

    // Set first step to RUNNING
    if (newJob.steps.length > 0) {
        newJob.steps[0].status = JobStatus.RUNNING;
    }

    // Update Local State AND DB
    setJobs(prev => [newJob, ...prev]);
    setSelectedJobId(newJob.id);
    await db.saveJob(newJob);

    // --- ORCHESTRATION LOOP ---
    try {
      // Shared Context
      let currentContext: any = {
          channel,
          topic: newTopic,
          videoType,
          duration: durationConfig,
          visualConfig,
          isShorts: isShorts,
          // Seed with manual data
          idea: newTopic, 
          angle: "Manual Angle",
          titles: [],
          selectedTitle: stepControl.title === 'manual' ? { selected_title: manualTitle } : null,
          script: stepControl.script === 'manual' ? manualScript : null,
      };

      // Helper to find step index by role
      const getStepIdx = (role: AgentRole) => newJob.steps.findIndex(s => s.agentRole === role);

      // Helper to persist updates
      const persistJob = async (jobId: string, updates: Partial<ProductionJob>) => {
          setJobs(prev => {
              const updatedList = prev.map(j => j.id === jobId ? { ...j, ...updates } : j);
              const updatedJob = updatedList.find(j => j.id === jobId);
              if (updatedJob) db.saveJob(updatedJob); 
              return updatedList;
          });
      };

      // --- EXECUTION LOGIC (Updated for Shorts) ---
      
      if (isShorts) {
          // 1. Hook Strategy
          const sh1 = await AgentRegistry[AgentRole.HOOK_MAKER].execute(currentContext);
          if(!sh1.ok) throw new Error(sh1.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.HOOK_MAKER), JobStatus.COMPLETED, undefined, sh1.usage);
          currentContext = { ...currentContext, ...sh1.outputs }; // Gets hooks, outline

          // 2. Titles
          const sh2 = await AgentRegistry[AgentRole.TITLE_OPTIMIZER].execute({ ...currentContext, language: channel.language });
          if(!sh2.ok) throw new Error(sh2.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.TITLE_OPTIMIZER), JobStatus.COMPLETED, undefined, sh2.usage);
          currentContext.titles = sh2.outputs.titles;

          const sh3 = await AgentRegistry[AgentRole.TITLE_SELECTOR].execute({ titles: currentContext.titles, channelStyle: channel.tone });
          if(!sh3.ok) throw new Error(sh3.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.TITLE_SELECTOR), JobStatus.COMPLETED, undefined, sh3.usage);
          updateJobArtifacts(newJob.id, { selectedTitle: sh3.outputs });
          await persistJob(newJob.id, { title: sh3.outputs.selected_title });

          // 3. Micro Script
          updateJobStep(newJob.id, getStepIdx(AgentRole.MICRO_SCRIPT_BUILDER), JobStatus.RUNNING);
          const sh4 = await AgentRegistry[AgentRole.MICRO_SCRIPT_BUILDER].execute({ 
              ...currentContext, 
              hook: currentContext.hooks?.[0], 
              outline: currentContext.outline,
              durationSec: durationConfig.target_value
          });
          if(!sh4.ok) throw new Error(sh4.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.MICRO_SCRIPT_BUILDER), JobStatus.COMPLETED, undefined, sh4.usage);
          
          // 4. Pacing
          const sh5 = await AgentRegistry[AgentRole.PACING_REVIEWER].execute({ script: sh4.outputs.script_final });
          if(!sh5.ok) throw new Error(sh5.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.PACING_REVIEWER), JobStatus.COMPLETED, undefined, sh5.usage);
          updateJobArtifacts(newJob.id, { refinedScript: sh5.outputs.refined_script });
          currentContext.script = sh5.outputs.refined_script;

          // 5. Shot Planning
          const sh6 = await AgentRegistry[AgentRole.SCENE_PLANNER].execute({ script: currentContext.script, visualStyle: channel.visualStyle });
          if(!sh6.ok) throw new Error(sh6.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.SCENE_PLANNER), JobStatus.COMPLETED, undefined, sh6.usage);
          updateJobArtifacts(newJob.id, { scenePlan: sh6.outputs.scenes });
          currentContext.scenes = sh6.outputs.scenes;

          // 6. Visuals (Vertical)
          updateJobStep(newJob.id, getStepIdx(AgentRole.VISUAL_PRODUCER), JobStatus.RUNNING);
          const sh7 = await AgentRegistry[AgentRole.VISUAL_PRODUCER].execute({ scenes: currentContext.scenes, visualConfig });
          if(!sh7.ok) throw new Error(sh7.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.VISUAL_PRODUCER), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { scenesWithImages: sh7.outputs.scenes });
          currentContext.scenes = sh7.outputs.scenes; 

          // 7. Voice
          updateJobStep(newJob.id, getStepIdx(AgentRole.VOICE_DIRECTOR), JobStatus.RUNNING);
          const sh8 = await AgentRegistry[AgentRole.VOICE_DIRECTOR].execute({ scenes: currentContext.scenes, voiceName: 'Kore', channel });
          if(!sh8.ok) throw new Error(sh8.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.VOICE_DIRECTOR), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { scenesWithAudio: sh8.outputs.scenes, fullAudioUrl: sh8.outputs.fullAudioUrl });
          currentContext.scenes = sh8.outputs.scenes; 
          currentContext.fullAudioBlob = sh8.outputs.fullAudioBlob; // Capture Global Audio
          currentContext.voiceProfile = sh8.outputs.voiceStyle; // Pass voice style for music match
          currentContext.durationSeconds = sh8.outputs.duration_seconds;

          // 8. Music (Optional)
          if (stepControl.music === 'auto') {
              updateJobStep(newJob.id, getStepIdx(AgentRole.MUSIC_DIRECTOR), JobStatus.RUNNING);
              const shM = await AgentRegistry[AgentRole.MUSIC_DIRECTOR].execute({ 
                  videoType: 'shorts',
                  channel,
                  voiceProfile: currentContext.voiceProfile,
                  durationSeconds: currentContext.durationSeconds,
                  script: currentContext.script
              });
              if(!shM.ok) throw new Error(shM.errorMessage);
              updateJobStep(newJob.id, getStepIdx(AgentRole.MUSIC_DIRECTOR), JobStatus.COMPLETED, undefined, shM.usage);
              updateJobArtifacts(newJob.id, { musicConfig: shM.outputs.musicConfig, musicTrack: shM.outputs.selectedTrack });
              currentContext.musicTrack = shM.outputs.selectedTrack;
              currentContext.musicConfig = shM.outputs.musicConfig;
          }

          // 9. Assembly (Vertical)
          updateJobStep(newJob.id, getStepIdx(AgentRole.EDITOR_ASSEMBLER), JobStatus.RUNNING);
          const sh9 = await AgentRegistry[AgentRole.EDITOR_ASSEMBLER].execute({ 
              scenes: currentContext.scenes, 
              visualConfig, 
              fullAudioBlob: currentContext.fullAudioBlob, // Pass Global Audio
              musicTrack: currentContext.musicTrack, // Pass Music
              musicConfig: currentContext.musicConfig
          });
          if(!sh9.ok) throw new Error(sh9.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.EDITOR_ASSEMBLER), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { 
            finalVideoBlob: sh9.outputs.videoBlob, 
            finalVideoUrl: sh9.outputs.videoUrl 
          });

          // 10. QA
          updateJobStep(newJob.id, getStepIdx(AgentRole.QA_REVIEWER), JobStatus.RUNNING);
          const sh10 = await AgentRegistry[AgentRole.QA_REVIEWER].execute({ 
              videoBlob: sh9.outputs.videoBlob, 
              durationConfig 
          });
          if(!sh10.ok) throw new Error(sh10.errorMessage);
          updateJobStep(newJob.id, getStepIdx(AgentRole.QA_REVIEWER), JobStatus.COMPLETED, `QA: ${sh10.outputs.status}`);

          await persistJob(newJob.id, { status: JobStatus.COMPLETED });

      } else {
          // --- EXISTING LONG FORM LOGIC (Condensed for brevity, kept mostly same) ---
          
          if (stepControl.title === 'agent') {
            const s1 = await AgentRegistry[AgentRole.STRATEGY_DIRECTOR].execute(currentContext);
            updateJobStep(newJob.id, getStepIdx(AgentRole.STRATEGY_DIRECTOR), JobStatus.COMPLETED, undefined, s1.usage);
            currentContext = { ...currentContext, ...s1.outputs };

            const s2 = await AgentRegistry[AgentRole.TITLE_OPTIMIZER].execute({ ...currentContext, language: channel.language });
            updateJobStep(newJob.id, getStepIdx(AgentRole.TITLE_OPTIMIZER), JobStatus.COMPLETED, undefined, s2.usage);
            currentContext.titles = s2.outputs.titles;

            const s3 = await AgentRegistry[AgentRole.TITLE_SELECTOR].execute({ titles: currentContext.titles, channelStyle: channel.tone });
            updateJobStep(newJob.id, getStepIdx(AgentRole.TITLE_SELECTOR), JobStatus.COMPLETED, undefined, s3.usage);
            updateJobArtifacts(newJob.id, { selectedTitle: s3.outputs });
            await persistJob(newJob.id, { title: s3.outputs.selected_title });
          }

          if (stepControl.script === 'agent') {
            const s4 = await AgentRegistry[AgentRole.STRUCTURE_AGENT].execute({ outline: currentContext.outline, duration: durationConfig });
            updateJobStep(newJob.id, getStepIdx(AgentRole.STRUCTURE_AGENT), JobStatus.COMPLETED, undefined, s4.usage);

            const s5 = await AgentRegistry[AgentRole.SCRIPT_BUILDER].execute({ chapters: s4.outputs.chapters, channel });
            updateJobStep(newJob.id, getStepIdx(AgentRole.SCRIPT_BUILDER), JobStatus.COMPLETED, undefined, s5.usage);

            const s6 = await AgentRegistry[AgentRole.PACING_REVIEWER].execute({ script: s5.outputs.script_final });
            updateJobStep(newJob.id, getStepIdx(AgentRole.PACING_REVIEWER), JobStatus.COMPLETED, undefined, s6.usage);
            updateJobArtifacts(newJob.id, { refinedScript: s6.outputs.refined_script });
            currentContext.script = s6.outputs.refined_script;
          }

          if (stepControl.scenes === 'agent') {
            const s7 = await AgentRegistry[AgentRole.SCENE_PLANNER].execute({ script: currentContext.script, visualStyle: channel.visualStyle });
            updateJobStep(newJob.id, getStepIdx(AgentRole.SCENE_PLANNER), JobStatus.COMPLETED, undefined, s7.usage);
            updateJobArtifacts(newJob.id, { scenePlan: s7.outputs.scenes });
            currentContext.scenes = s7.outputs.scenes;
          }

          const s8 = await AgentRegistry[AgentRole.VISUAL_PRODUCER].execute({ scenes: currentContext.scenes, visualConfig });
          updateJobStep(newJob.id, getStepIdx(AgentRole.VISUAL_PRODUCER), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { scenesWithImages: s8.outputs.scenes });
          currentContext.scenes = s8.outputs.scenes;

          const s9 = await AgentRegistry[AgentRole.VOICE_DIRECTOR].execute({ scenes: currentContext.scenes, voiceName: 'Kore', channel });
          updateJobStep(newJob.id, getStepIdx(AgentRole.VOICE_DIRECTOR), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { scenesWithAudio: s9.outputs.scenes, fullAudioUrl: s9.outputs.fullAudioUrl });
          currentContext.scenes = s9.outputs.scenes;
          currentContext.fullAudioBlob = s9.outputs.fullAudioBlob; // Capture Global Audio
          currentContext.voiceProfile = s9.outputs.voiceStyle;
          currentContext.durationSeconds = s9.outputs.duration_seconds;

          // Music Step Check
          if (stepControl.music === 'auto') {
              updateJobStep(newJob.id, getStepIdx(AgentRole.MUSIC_DIRECTOR), JobStatus.RUNNING);
              const sM = await AgentRegistry[AgentRole.MUSIC_DIRECTOR].execute({ 
                  videoType: 'long_narrative',
                  channel,
                  voiceProfile: currentContext.voiceProfile,
                  durationSeconds: currentContext.durationSeconds,
                  script: currentContext.script
              });
              if(!sM.ok) throw new Error(sM.errorMessage);
              updateJobStep(newJob.id, getStepIdx(AgentRole.MUSIC_DIRECTOR), JobStatus.COMPLETED, undefined, sM.usage);
              updateJobArtifacts(newJob.id, { musicConfig: sM.outputs.musicConfig, musicTrack: sM.outputs.selectedTrack });
              currentContext.musicTrack = sM.outputs.selectedTrack;
              currentContext.musicConfig = sM.outputs.musicConfig;
          }

          const s10 = await AgentRegistry[AgentRole.EDITOR_ASSEMBLER].execute({ 
              scenes: currentContext.scenes, 
              visualConfig,
              fullAudioBlob: currentContext.fullAudioBlob, // Pass Global Audio
              musicTrack: currentContext.musicTrack,
              musicConfig: currentContext.musicConfig
          });
          updateJobStep(newJob.id, getStepIdx(AgentRole.EDITOR_ASSEMBLER), JobStatus.COMPLETED);
          updateJobArtifacts(newJob.id, { finalVideoBlob: s10.outputs.videoBlob, finalVideoUrl: s10.outputs.videoUrl });

          const s11 = await AgentRegistry[AgentRole.QA_REVIEWER].execute({ videoBlob: s10.outputs.videoBlob, durationConfig });
          updateJobStep(newJob.id, getStepIdx(AgentRole.QA_REVIEWER), JobStatus.COMPLETED, `QA: ${s11.outputs.status}`);
          
          await persistJob(newJob.id, { status: JobStatus.COMPLETED });
      }

    } catch (e: any) {
      console.error(e);
      setJobs(prev => prev.map(j => {
        if (j.id === newJob.id) {
          const failedStepIndex = j.steps.findIndex(s => s.status === JobStatus.RUNNING);
          const updatedSteps = [...j.steps];
          if (failedStepIndex >= 0) {
              updatedSteps[failedStepIndex] = { ...updatedSteps[failedStepIndex], status: JobStatus.FAILED, errorMessage: e.message };
          }
          const failedJob = { ...j, status: JobStatus.FAILED, steps: updatedSteps };
          db.saveJob(failedJob); 
          return failedJob;
        }
        return j;
      }));
    } finally {
      setIsGenerating(false);
      setNewTopic('');
    }
  };

  const updateJobStep = (jobId: string, stepIndex: number, status: JobStatus, summary?: string, usage?: any) => {
      setJobs(prev => prev.map(j => {
          if (j.id === jobId && stepIndex >= 0) {
              const updatedSteps = [...j.steps];
              updatedSteps[stepIndex] = { 
                  ...updatedSteps[stepIndex], 
                  status, 
                  outputSummary: summary || updatedSteps[stepIndex].outputSummary,
                  tokenUsage: usage 
              };
              return { ...j, steps: updatedSteps, currentStepIndex: status === JobStatus.COMPLETED ? stepIndex + 1 : stepIndex };
          }
          return j;
      }));
  };

  const updateJobArtifacts = (jobId: string, newArtifacts: any) => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, artifacts: { ...j.artifacts, ...newArtifacts } } : j));
  };

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6">
      {/* Job List & Config */}
      <div className="w-1/3 border-l border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h3 className="font-bold text-white mb-4">إنشاء مهمة جديدة (Production Control)</h3>
          
          <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            
            {/* 1. Production Type & Topic */}
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

                <label className="text-xs text-slate-500 font-bold mb-1 block">1. الموضوع (Topic)</label>
                <input 
                type="text" 
                placeholder="عن ماذا يتحدث الفيديو؟" 
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                />
            </div>

            {/* 2. Visual Mode & Duration */}
            <div className="grid grid-cols-2 gap-3">
                {/* Visual Mode (Only for Long, Shorts are forced Video) */}
                <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">Visual Mode</label>
                    {productionType === 'Shorts' ? (
                        <div className="w-full bg-slate-900 text-slate-400 text-xs py-2 px-2 rounded border border-slate-700 flex items-center justify-between">
                            <span>Shorts = Video</span>
                            <span className="text-[10px] bg-purple-900 text-purple-200 px-1 rounded">Locked</span>
                        </div>
                    ) : (
                        <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                            <button 
                                onClick={() => setVisualMode('images')} 
                                className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${visualMode === 'images' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                            >
                                <ImageIcon size={12} /> Images
                            </button>
                            <button 
                                onClick={() => setVisualMode('video')} 
                                className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${visualMode === 'video' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                            >
                                <Video size={12} /> Veo
                            </button>
                        </div>
                    )}
                </div>

                {/* Duration */}
                <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">
                        Duration ({productionType === 'Shorts' ? 'sec' : 'min'})
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 h-[34px]">
                        <Clock size={14} className="text-slate-500" />
                        <input 
                            type="number"
                            min="1"
                            max={productionType === 'Shorts' ? 60 : 100}
                            value={durationInput}
                            onChange={(e) => setDurationInput(parseInt(e.target.value) || 1)}
                            className="bg-transparent text-xs text-white outline-none w-full text-center"
                        />
                    </div>
                </div>
            </div>
            
            {/* Music Control */}
            <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">Music Director</label>
                <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                    <button 
                        onClick={() => setStepControl({...stepControl, music: 'auto'})} 
                        className={`flex-1 text-xs py-1.5 rounded ${stepControl.music === 'auto' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                    >
                        Auto Mix
                    </button>
                    <button 
                        onClick={() => setStepControl({...stepControl, music: 'off'})} 
                        className={`flex-1 text-xs py-1.5 rounded ${stepControl.music === 'off' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                    >
                        Off
                    </button>
                </div>
            </div>
            
            {/* Shorts Provider Selection */}
            {productionType === 'Shorts' && (
                 <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">Video Provider (Shorts)</label>
                    <select 
                        value={shortsProvider} 
                        onChange={(e) => setShortsProvider(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    >
                        <option value="veo_3_1_fast">Veo 3.1 Fast (Primary)</option>
                        <option value="veo_2">Veo 2.0 (Legacy)</option>
                    </select>
                 </div>
            )}

            <button 
                onClick={handleCreateJob}
                disabled={isGenerating || !newTopic}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>}
                <span>Start Production Run</span>
            </button>
          </div>

        </div>
        
        {/* Jobs List */}
        <div className="overflow-y-auto flex-1 bg-slate-950/50">
          {loading ? (
             <div className="text-center p-4 text-slate-500 text-sm">جاري التحميل...</div>
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
                <div className="flex gap-2 mt-2">
                    {job.type === 'Shorts' ? (
                         <span className="text-[10px] bg-purple-900/30 text-purple-400 border border-purple-800 px-1 rounded flex items-center gap-1">
                            <Smartphone size={8} /> Shorts
                         </span>
                    ) : (
                         <span className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800 px-1 rounded flex items-center gap-1">
                            <MonitorPlay size={8} /> Long
                         </span>
                    )}
                </div>
                </div>
            ))
          )}
        </div>
      </div>

      {/* Pipeline View */}
      <div className="w-2/3 bg-slate-950 flex flex-col">
        {selectedJob ? (
          <>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedJob.title}</h2>
                <div className="flex gap-4 mt-1 text-sm text-slate-400">
                    <span className="font-mono">ID: {selectedJob.id}</span>
                    {selectedJob.durationConfig && (
                        <span className="flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 rounded-full text-xs">
                            <Clock size={12} /> {selectedJob.durationConfig.target_value} {selectedJob.durationConfig.unit || (selectedJob.type === 'Shorts' ? 'sec' : 'min')}
                        </span>
                    )}
                </div>
              </div>
              <div className="flex gap-3">
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition">عرض السجلات</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="relative">
                {/* Connector Line */}
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
                          step.status === JobStatus.SKIPPED ? 'border-slate-700 text-slate-500 bg-slate-800' :
                          step.status === JobStatus.FAILED ? 'border-red-500 text-red-500' :
                          'border-slate-700 text-slate-700'
                        }`}>
                          <StatusIcon status={step.status} />
                        </div>

                        {/* Content */}
                        <div className={`flex-1 rounded-xl border p-5 transition-all ${
                          isCurrent ? 'bg-slate-900 border-blue-500/30' : 
                          step.status === JobStatus.SKIPPED ? 'bg-slate-950/30 border-slate-800 opacity-60' :
                          'bg-slate-900/50 border-slate-800'
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className={`font-bold text-lg ${isCurrent ? 'text-blue-400' : step.status === JobStatus.SKIPPED ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{step.name}</h4>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Agent: {step.agentRole}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {step.status === JobStatus.SKIPPED && <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">SKIPPED (Manual)</span>}
                                {step.tokenUsage && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800" title="Token Usage">
                                        <Zap size={10} className="text-amber-500" />
                                        <span>{step.tokenUsage.total.toLocaleString()} tokens</span>
                                    </div>
                                )}
                            </div>
                          </div>

                          {/* Artifact Display */}
                          <div className="mt-4 space-y-4">
                            
                            {/* Selected Title */}
                            {(step.agentRole === AgentRole.TITLE_SELECTOR || step.agentRole === AgentRole.HOOK_MAKER) && selectedJob.artifacts.selectedTitle && (
                                <div className="bg-blue-900/10 border border-blue-900/50 p-4 rounded-lg">
                                    <p className="text-sm font-bold text-blue-400 mb-1">Selected Title / Hook</p>
                                    <h3 className="text-xl font-bold text-white mb-2">{selectedJob.artifacts.selectedTitle.selected_title}</h3>
                                </div>
                            )}

                            {/* Script Preview */}
                            {(step.agentRole === AgentRole.PACING_REVIEWER || step.agentRole === AgentRole.MICRO_SCRIPT_BUILDER) && selectedJob.artifacts.refinedScript && (
                                <div className="bg-slate-950 p-4 rounded border border-slate-800 text-slate-400 text-sm max-h-32 overflow-y-auto">
                                    {selectedJob.artifacts.refinedScript}
                                </div>
                            )}

                            {/* Music Selection */}
                            {step.agentRole === AgentRole.MUSIC_DIRECTOR && selectedJob.artifacts.musicConfig && (
                                <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-lg flex items-center gap-4">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                                        <Music size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-green-400 mb-1">Music Selected</p>
                                        <div className="text-white text-sm">
                                            {selectedJob.artifacts.musicTrack ? selectedJob.artifacts.musicTrack.title : 'No Track Selected'}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            Mix: {selectedJob.artifacts.musicConfig.mixing.music_volume_db}dB | Ducking: {selectedJob.artifacts.musicConfig.mixing.ducking_db}dB
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Visuals Generated */}
                            {step.agentRole === AgentRole.VISUAL_PRODUCER && selectedJob.artifacts.scenesWithImages && (
                                <div className="grid grid-cols-4 gap-2">
                                    {(selectedJob.artifacts.scenesWithImages as any[]).map((s, i) => (
                                        <div key={i} className={`bg-slate-950 rounded overflow-hidden relative group border border-slate-800 ${selectedJob.type === 'Shorts' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                                            {s.mediaType === 'video' ? (
                                                <>
                                                    <video src={s.generatedVideoUrl} className="w-full h-full object-cover opacity-80" muted autoPlay loop />
                                                    <div className="absolute top-1 right-1 bg-purple-600 text-[8px] text-white px-1 rounded">VEO</div>
                                                </>
                                            ) : (
                                                <img src={s.generatedImageUrl} alt="" className="w-full h-full object-cover" />
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white p-1 truncate">
                                                Scene {s.scene_id}
                                            </div>
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
                            
                          </div>

                           {/* Error Display */}
                           {step.errorMessage && (
                            <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm">
                                Error: {step.errorMessage}
                                <button className="block mt-2 text-xs underline hover:text-red-300">Retry Step</button>
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
            <p>اختر مهمة لعرض تفاصيل خط الإنتاج</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Production;
