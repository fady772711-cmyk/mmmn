
import React, { useState, useEffect } from 'react';
import { 
    AutomationConfig, Channel, ProviderConfig, 
    AutomationAgentConfig, AutomationVideoSpecs, AutomationVisualConfig, AutomationScheduleConfig,
    VoicePreset, AutomationVoiceSettings, AutomationPublishConfig, ProductionJob, JobStatus,
    Campaign
} from '../types';
import { db } from '../services/storageService';
import { server } from '../services/serverOrchestrator';
import { 
    Workflow, Play, Pause, Trash2, Plus, ArrowRight, CheckCircle2, 
    AlertTriangle, ShieldAlert, MonitorPlay, Smartphone, Bot, Clock, 
    Image as ImageIcon, Video, Mic, Calendar, Youtube, Save, X, Activity, Type as TypeIcon, Layers, Settings2, LineChart, DollarSign, CloudLightning, Rocket,
    ListVideo, Loader2 as Spinner, Edit, FileText
} from 'lucide-react';
import InlineCopilot from '../components/InlineCopilot';

const FEATURE_AUTOMATIONS = true;

const Automations: React.FC = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'campaigns' | 'pipelines' | 'logs'>('campaigns');

  const [automations, setAutomations] = useState<AutomationConfig[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  
  // Recent Activity State
  const [todaysJobs, setTodaysJobs] = useState<ProductionJob[]>([]);
  
  // Pipeline Builder State
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Campaign Builder State
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [campaignConfig, setCampaignConfig] = useState<Partial<Campaign>>({
      config: {
          videosPerDay: 5,
          creationTime: '08:00',
          publishTimes: ['12:00', '14:00', '16:00', '18:00', '20:00'],
          publishMode: 'Scheduled',
          recurrence: 'Daily'
      },
      topicManager: {
          mode: 'List',
          pendingTopics: [],
          completedTopics: []
      }
  });
  const [topicInput, setTopicInput] = useState(''); // Textarea content

  // New Automation Configuration State (Pipeline)
  const [config, setConfig] = useState<Partial<AutomationConfig>>({
      isEnabled: false,
      agents: {
          analyst: 'auto', // Default Enabled
          strategy: 'auto', script: 'auto', visuals: 'auto', voice: 'auto', music: 'auto'
      },
      specs: {
          durationUnit: 'minutes', targetDuration: 10, videosPerDay: 1
      },
      visuals: {
          provider: 'nano_banana', 
          mode: 'images', 
          fallbackProvider: 'images',
          imageQuantityMode: 'auto',
          enableTextOverlay: true,
          textOverlayStyle: 'cinematic'
      },
      voiceSettings: {
          mode: 'auto_match_channel',
          speed: 1.0
      },
      schedule: {
          timezone: 'Asia/Riyadh', times: ['12:00'], days: ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'], startDate: new Date().toISOString().split('T')[0], useAdminPlanner: true
      },
      publishing: {
          mode: 'Private',
          enableMonetization: true,
          markAsAI: true,
          autoScheduleOffsetHours: 24
      }
  });

  useEffect(() => {
    loadData();
    // Poll for jobs every 5 seconds
    const interval = setInterval(fetchRecentJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [auths, camps, chans, provs, voicesData] = await Promise.all([
        db.getAutomations(),
        db.getCampaigns(),
        db.getChannels(),
        db.getProviders(),
        db.getVoices()
    ]);
    setAutomations(auths);
    setCampaigns(camps);
    setChannels(chans);
    setProviders(provs);
    setVoices(voicesData);
    setLoading(false);
    fetchRecentJobs();
  };

  const fetchRecentJobs = async () => {
      try {
          const res = await fetch('/api/jobs');
          if (res.ok) {
              const allJobs: ProductionJob[] = await res.json();
              const today = new Date().toISOString().split('T')[0];
              const relevant = allJobs.filter(j => 
                  j.createdAt.startsWith(today) && 
                  (j.id.startsWith('job_') && (j.type === 'Shorts' || j.type === 'Long')) 
              );
              relevant.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setTodaysJobs(relevant);
          }
      } catch (e) {
          console.error("Failed to fetch jobs", e);
      }
  };

  // --- HELPER FUNCTIONS ---

  const COPILOT_SYSTEM_PROMPT = `You are an Automation Architect.
    Your goal: Help user configure production pipelines.
    
    User might say: "Create a pipeline for History Shorts daily at 5pm".
    Action: 'configure_pipeline'
    Payload: {
      channelId: "ch_...", // Infer if possible or ask
      pipelineLine: "Shorts",
      specs: { videosPerDay: 1 },
      schedule: { times: ["17:00"], days: ["Daily"] }
    }
  `;

  const handleCopilotAction = (action: string, payload: any) => {
      if (action === 'configure_pipeline') {
           setConfig(prev => ({
               ...prev,
               ...payload
           }));
      }
  };

  const validateStep = (step: number): boolean => {
      setValidationError(null);
      if (step === 1 && !config.channelId) {
          setValidationError("الرجاء اختيار قناة.");
          return false;
      }
      if (step === 2 && !config.pipelineLine) {
          setValidationError("الرجاء اختيار نوع خط الإنتاج.");
          return false;
      }
      return true;
  };

  const handleSave = async () => {
      if (!config.channelId || !config.pipelineLine) return;
      
      const newAutomation: AutomationConfig = {
          id: `auto_${Date.now()}`,
          name: `${config.pipelineLine} Pipeline - ${new Date().toLocaleDateString()}`,
          isEnabled: true,
          channelId: config.channelId,
          pipelineLine: config.pipelineLine,
          agents: config.agents as AutomationAgentConfig,
          specs: config.specs as AutomationVideoSpecs,
          visuals: config.visuals as AutomationVisualConfig,
          voiceSettings: config.voiceSettings as AutomationVoiceSettings,
          schedule: config.schedule as AutomationScheduleConfig,
          publishing: config.publishing as AutomationPublishConfig,
          planningMode: 'Agent'
      };
      
      await db.saveAutomation(newAutomation);
      await loadData();
      setIsBuilding(false);
      setConfig({
          isEnabled: false,
          agents: {
              analyst: 'auto',
              strategy: 'auto', script: 'auto', visuals: 'auto', voice: 'auto', music: 'auto'
          },
          specs: {
              durationUnit: 'minutes', targetDuration: 10, videosPerDay: 1
          },
          visuals: {
              provider: 'nano_banana', 
              mode: 'images', 
              fallbackProvider: 'images',
              imageQuantityMode: 'auto',
              enableTextOverlay: true,
              textOverlayStyle: 'cinematic'
          },
          voiceSettings: {
              mode: 'auto_match_channel',
              speed: 1.0
          },
          schedule: {
              timezone: 'Asia/Riyadh', times: ['12:00'], days: ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'], startDate: new Date().toISOString().split('T')[0], useAdminPlanner: true
          },
          publishing: {
              mode: 'Private',
              enableMonetization: true,
              markAsAI: true,
              autoScheduleOffsetHours: 24
          }
      });
      setActiveStep(1);
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("هل أنت متأكد من حذف هذه القاعدة؟")) {
          await db.deleteAutomation(id);
          loadData();
      }
  };

  // --- Campaign Handlers ---
  const openNewCampaign = () => {
      setCampaignConfig({
          id: `camp_${Date.now()}`,
          status: 'ACTIVE',
          pipelineType: 'Shorts',
          config: {
              videosPerDay: 5,
              creationTime: '08:00',
              publishTimes: ['12:00', '14:00', '16:00', '18:00', '20:00'],
              publishMode: 'Scheduled',
              recurrence: 'Daily'
          },
          topicManager: {
              mode: 'List',
              pendingTopics: [],
              completedTopics: []
          }
      });
      setTopicInput('');
      setIsEditingCampaign(true);
  };

  const saveCampaign = async () => {
      if (!campaignConfig.name || !campaignConfig.channelId) {
          alert("الرجاء إدخال اسم الحملة والقناة");
          return;
      }

      // Parse topics
      const rawTopics = topicInput.split('\n').map(t => t.trim()).filter(t => t);
      // Merge with existing pending if editing
      const finalTopics = [...(campaignConfig.topicManager?.pendingTopics || []), ...rawTopics];
      // Deduplicate
      const uniqueTopics = Array.from(new Set(finalTopics));

      const newCampaign: Campaign = {
          ...campaignConfig as Campaign,
          topicManager: {
              ...campaignConfig.topicManager!,
              pendingTopics: uniqueTopics
          },
          createdAt: campaignConfig.createdAt || new Date().toISOString()
      };

      await db.saveCampaign(newCampaign);
      await loadData();
      setIsEditingCampaign(false);
  };

  const deleteCampaign = async (id: string) => {
      if(confirm("حذف الحملة؟")) {
          await db.deleteCampaign(id);
          loadData();
      }
  };

  // --- Render Steps (Pipeline Builder) ---
  const renderStepContent = () => {
      switch(activeStep) {
          case 1: return <div className="space-y-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Activity /> اختر القناة المستهدفة</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{channels.map(ch => (<div key={ch.id} onClick={() => setConfig({...config, channelId: ch.id})} className={`p-4 rounded-xl border cursor-pointer transition ${config.channelId === ch.id ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><div className="font-bold text-slate-200">{ch.name}</div><div className="text-xs text-slate-500 mt-1">{ch.language} • {ch.tone}</div></div>))}</div></div>;
          case 2: return <div className="space-y-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Workflow /> خط الإنتاج (Pipeline)</h3><div className="grid grid-cols-3 gap-4">{[{ id: 'Shorts', label: 'Shorts', icon: Smartphone }, { id: 'Long Narrative', label: 'Long Narrative', icon: MonitorPlay }, { id: 'Long Explainer', label: 'Long Explainer', icon: MonitorPlay }].map(line => (<div key={line.id} onClick={() => setConfig({...config, pipelineLine: line.id as any, specs: { ...config.specs!, durationUnit: line.id === 'Shorts' ? 'seconds' : 'minutes', targetDuration: line.id === 'Shorts' ? 45 : 8 }, visuals: { ...config.visuals!, mode: line.id === 'Shorts' ? 'video' : 'images', provider: line.id === 'Shorts' ? 'veo_3_1_fast' : 'nano_banana' }})} className={`p-6 rounded-xl border cursor-pointer flex flex-col items-center text-center transition ${config.pipelineLine === line.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}><div className={`p-3 rounded-full mb-3 ${config.pipelineLine === line.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}><line.icon size={24} /></div><div className="font-bold text-slate-200">{line.label}</div></div>))}</div></div>;
          default: return <div className="text-slate-500">Configure other settings (Agents, Specs, Visuals, Voice, Schedule, Publishing) in steps 3-8...</div>;
      }
  };

  const StepsIndicator = () => (
      <div className="flex items-center justify-between mb-8 px-2 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-10"></div>
          {[1,2,3,4,5,6,7,8].map(s => {
              const active = s <= activeStep;
              return (<div key={s} className={`flex flex-col items-center gap-2 ${active ? 'text-blue-500' : 'text-slate-600'}`}><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${s === activeStep ? 'bg-blue-600 text-white border-blue-600' : active ? 'bg-slate-950 border-blue-600' : 'bg-slate-950 border-slate-800'}`}>{s}</div></div>);
          })}
      </div>
  );

  // --- JOB STATUS HELPERS ---
  const getStatusBadge = (status: JobStatus) => {
      switch(status) {
          case JobStatus.COMPLETED: return <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs border border-green-500/20 flex items-center gap-1"><CheckCircle2 size={12} /> مكتمل</span>;
          case JobStatus.RUNNING: return <span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-xs border border-blue-500/20 flex items-center gap-1"><Spinner size={12} className="animate-spin" /> جاري المعالجة</span>;
          case JobStatus.FAILED: return <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-xs border border-red-500/20 flex items-center gap-1"><AlertTriangle size={12} /> فشل</span>;
          default: return <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs border border-slate-700">قيد الانتظار</span>;
      }
  };

  const getPublishStatus = (job: ProductionJob) => {
      const pubStep = job.steps.find(s => s.agentRole === 'Publisher');
      if (pubStep?.status === JobStatus.COMPLETED) {
          return <span className="text-green-400 text-xs flex items-center gap-1"><Calendar size={12} /> Scheduled</span>;
      } else if (pubStep?.status === JobStatus.RUNNING) {
          return <span className="text-blue-400 text-xs">Publishing...</span>;
      }
      return <span className="text-slate-600 text-xs">-</span>;
  };

  // --- NAVIGATION TABS ---
  const renderTabs = () => (
      <div className="flex gap-4 border-b border-slate-800 mb-6">
          <button onClick={() => setActiveTab('campaigns')} className={`pb-3 px-2 border-b-2 transition ${activeTab === 'campaigns' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400'}`}>
              إدارة الحملات (Campaigns)
          </button>
          <button onClick={() => setActiveTab('pipelines')} className={`pb-3 px-2 border-b-2 transition ${activeTab === 'pipelines' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-400'}`}>
              قواعد الأتمتة (Blueprints)
          </button>
          <button onClick={() => setActiveTab('logs')} className={`pb-3 px-2 border-b-2 transition ${activeTab === 'logs' ? 'border-green-500 text-green-400 font-bold' : 'border-transparent text-slate-400'}`}>
              سجل الإنتاج
          </button>
      </div>
  );

  if (!FEATURE_AUTOMATIONS) return <div className="p-10 text-center text-slate-500">Feature Disabled</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">الأتمتة والجدولة</h2>
          <p className="text-slate-400">إدارة خطوط الإنتاج وحملات النشر</p>
        </div>
        {!isBuilding && !isEditingCampaign && (
            <div className="flex gap-2">
                {activeTab === 'campaigns' && (
                    <button onClick={openNewCampaign} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                        <Plus size={18} />
                        <span>حملة جديدة</span>
                    </button>
                )}
                {activeTab === 'pipelines' && (
                    <button onClick={() => setIsBuilding(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                        <Plus size={18} />
                        <span>قاعدة جديدة</span>
                    </button>
                )}
            </div>
        )}
      </div>

      {/* Render Main Content */}
      {!isBuilding && !isEditingCampaign && renderTabs()}

      {/* 1. CAMPAIGN MANAGER VIEW */}
      {activeTab === 'campaigns' && !isEditingCampaign && !isBuilding && (
          <div className="grid grid-cols-1 gap-4">
              {campaigns.length === 0 && (
                  <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl">
                      <ListVideo size={48} className="mx-auto text-slate-700 mb-4" />
                      <p className="text-slate-500">لا توجد حملات نشطة. قم بإنشاء حملة لجدولة مجموعة من الفيديوهات.</p>
                  </div>
              )}
              {campaigns.map(camp => {
                  const ch = channels.find(c => c.id === camp.channelId);
                  const progress = (camp.topicManager.completedTopics.length / (camp.topicManager.pendingTopics.length + camp.topicManager.completedTopics.length)) * 100 || 0;
                  
                  return (
                      <div key={camp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:border-slate-700 transition">
                          <div className="flex items-start gap-4 flex-1">
                              <div className="bg-purple-900/20 p-3 rounded-lg text-purple-400 border border-purple-900/50">
                                  <Rocket size={24} />
                              </div>
                              <div>
                                  <h3 className="font-bold text-white text-lg">{camp.name}</h3>
                                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                                      <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{ch?.name}</span>
                                      <span>• {camp.pipelineType}</span>
                                      <span>• {camp.config.recurrence}</span>
                                      <span>• {camp.config.videosPerDay} videos/day</span>
                                  </div>
                                  
                                  {/* Stats */}
                                  <div className="flex gap-4 mt-4">
                                      <div className="text-center">
                                          <div className="text-xs text-slate-500">Pending</div>
                                          <div className="font-bold text-white">{camp.topicManager.pendingTopics.length}</div>
                                      </div>
                                      <div className="text-center">
                                          <div className="text-xs text-slate-500">Completed</div>
                                          <div className="font-bold text-green-500">{camp.topicManager.completedTopics.length}</div>
                                      </div>
                                      <div className="text-center">
                                          <div className="text-xs text-slate-500">Next Run</div>
                                          <div className="font-bold text-blue-400">{camp.config.creationTime}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="flex flex-col gap-2 justify-center w-full md:w-48 border-t md:border-t-0 md:border-r border-slate-800 md:pr-6 md:mr-2">
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                  <span>Progress</span>
                                  <span>{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                              </div>
                          </div>

                          <div className="flex items-center gap-2">
                              <button onClick={() => deleteCampaign(camp.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-900/10 rounded-full">
                                  <Trash2 size={20} />
                              </button>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* 2. CAMPAIGN EDITOR MODAL */}
      {isEditingCampaign && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Settings2 size={24} className="text-purple-500" />
                      إعداد الحملة (Campaign Setup)
                  </h3>
                  <button onClick={() => setIsEditingCampaign(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
              </div>

              <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">اسم الحملة</label>
                          <input 
                              value={campaignConfig.name || ''}
                              onChange={e => setCampaignConfig({...campaignConfig, name: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                              placeholder="مثال: حملة شورتات التاريخ - فبراير"
                          />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">القناة</label>
                          <select 
                              value={campaignConfig.channelId || ''}
                              onChange={e => setCampaignConfig({...campaignConfig, channelId: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                          >
                              <option value="">اختر قناة...</option>
                              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">عدد الفيديوهات</label>
                          <input 
                              type="number"
                              value={campaignConfig.config?.videosPerDay}
                              onChange={e => setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, videosPerDay: parseInt(e.target.value)}})}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                          />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">نوع التكرار</label>
                          <select 
                              value={campaignConfig.config?.recurrence}
                              onChange={e => setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, recurrence: e.target.value as any}})}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                          >
                              <option value="Daily">يومي (Daily)</option>
                              <option value="Once">مرة واحدة (Once)</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">حالة النشر</label>
                          <select 
                              value={campaignConfig.config?.publishMode}
                              onChange={e => setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, publishMode: e.target.value as any}})}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                          >
                              <option value="Scheduled">Scheduled</option>
                              <option value="Private">Private</option>
                              <option value="Draft">Draft</option>
                          </select>
                      </div>
                  </div>

                  {/* Timing */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">وقت بدء الإنشاء (Creation Time)</label>
                          <input 
                              type="time"
                              value={campaignConfig.config?.creationTime}
                              onChange={e => setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, creationTime: e.target.value}})}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">متى يبدأ السيرفر بتوليد الفيديوهات يومياً.</p>
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-2">أوقات النشر (Publish Times)</label>
                          <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border border-slate-700 rounded min-h-[42px]">
                              {campaignConfig.config?.publishTimes?.map((t, i) => (
                                  <span key={i} className="bg-slate-800 text-xs px-2 py-1 rounded border border-slate-600 flex items-center gap-1">
                                      {t} <button onClick={() => {
                                          const newTimes = campaignConfig.config!.publishTimes!.filter((_, idx) => idx !== i);
                                          setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, publishTimes: newTimes}});
                                      }}><X size={10}/></button>
                                  </span>
                              ))}
                              <button onClick={() => {
                                  const time = prompt("Add time (HH:MM)");
                                  if(time) setCampaignConfig({...campaignConfig, config: {...campaignConfig.config!, publishTimes: [...campaignConfig.config!.publishTimes!, time]}});
                              }} className="text-blue-400 text-xs hover:text-white">+ Add</button>
                          </div>
                      </div>
                  </div>

                  {/* Topic Manager */}
                  <div className="border-t border-slate-800 pt-4">
                      <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-bold text-white flex items-center gap-2">
                              <FileText size={16} className="text-blue-500" />
                              قائمة المواضيع (Topic List)
                          </label>
                          <span className="text-xs text-slate-500">سيتم شطب المواضيع المستخدمة تلقائياً لمنع التكرار.</span>
                      </div>
                      <textarea 
                          value={topicInput}
                          onChange={e => setTopicInput(e.target.value)}
                          placeholder="ألصق قائمة العناوين أو المواضيع هنا (كل موضوع في سطر مستقل)..."
                          className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 font-mono leading-relaxed focus:border-purple-500 outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-2 text-right">
                          عدد المواضيع المدخلة: {topicInput.split('\n').filter(t => t.trim()).length}
                      </p>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                      <button onClick={() => setIsEditingCampaign(false)} className="px-6 py-2 text-slate-400 hover:text-white">إلغاء</button>
                      <button onClick={saveCampaign} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold flex items-center gap-2">
                          <Save size={18} /> حفظ الحملة
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. PIPELINE BUILDER VIEW (Existing) */}
      {activeTab === 'pipelines' && isBuilding && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[600px]">
              <div className="bg-slate-900 p-6 border-b border-slate-800"><StepsIndicator /></div>
              <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 order-2 lg:order-1">
                      {renderStepContent()}
                      {validationError && (<div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 rounded flex items-center gap-2"><ShieldAlert size={18} /> {validationError}</div>)}
                  </div>
                  <div className="order-1 lg:order-2 space-y-6">
                       <InlineCopilot title="Automation Architect" systemPrompt={COPILOT_SYSTEM_PROMPT} onAction={handleCopilotAction} compact />
                  </div>
              </div>
              <div className="p-6 border-t border-slate-800 flex justify-between bg-slate-900">
                  <button onClick={() => { setIsBuilding(false); setConfig({}); setActiveStep(1); }} className="px-6 py-2 text-slate-400 hover:text-white">Cancel</button>
                  <div className="flex gap-3">
                      <button onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))} disabled={activeStep === 1} className="px-6 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-50">Back</button>
                      {activeStep < 8 ? (<button onClick={() => { if(validateStep(activeStep)) setActiveStep(prev => prev + 1); }} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex items-center gap-2">Next <ArrowRight size={18} /></button>) : (<button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold flex items-center gap-2"><Save size={18} /> Finish & Save</button>)}
                  </div>
              </div>
          </div>
      )}

      {/* 4. PIPELINES LIST (Existing) */}
      {activeTab === 'pipelines' && !isBuilding && (
          <div className="grid grid-cols-1 gap-4">
              {automations.map(auto => {
                  const channel = channels.find(c => c.id === auto.channelId);
                  return (
                      <div key={auto.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex justify-between items-center group hover:border-slate-700 transition">
                          <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold ${auto.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>{channel?.name.charAt(0)}</div>
                              <div><h3 className="font-bold text-white text-lg">{auto.name}</h3><div className="flex items-center gap-3 text-xs text-slate-400 mt-1"><span className="bg-slate-800 px-2 py-0.5 rounded">{auto.pipelineLine}</span><span>• {auto.specs.videosPerDay} videos/day</span></div></div>
                          </div>
                          <div className="flex items-center gap-3"><button onClick={() => { db.saveAutomation({...auto, isEnabled: !auto.isEnabled}).then(loadData); }} className={`p-2 rounded-full border ${auto.isEnabled ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{auto.isEnabled ? <Pause size={20} /> : <Play size={20} />}</button><button onClick={() => handleDelete(auto.id)} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-900/10 rounded-full transition"><Trash2 size={20} /></button></div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* 5. LOGS VIEW */}
      {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2"><ListVideo className="text-blue-500" /> سجل الإنتاج اليومي</h3>
                  <div className="text-xs text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{new Date().toLocaleDateString()}</div>
              </div>
              {todaysJobs.length === 0 ? <div className="p-10 text-center text-slate-500"><p>لا توجد عمليات إنتاج مسجلة لهذا اليوم.</p></div> : (
                  <table className="w-full text-right text-sm">
                      <thead className="bg-slate-950 text-slate-400 font-medium"><tr><th className="p-4">الوقت</th><th className="p-4">العنوان</th><th className="p-4">النوع</th><th className="p-4">التقدم</th><th className="p-4">حالة النشر</th></tr></thead>
                      <tbody className="divide-y divide-slate-800">
                          {todaysJobs.map(job => (
                              <tr key={job.id} className="hover:bg-slate-800/50 transition">
                                  <td className="p-4 text-slate-500 font-mono text-xs">{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="p-4"><div className="font-medium text-slate-200">{job.title}</div><div className="text-[10px] text-slate-500">{job.id}</div></td>
                                  <td className="p-4"><span className={`text-[10px] px-2 py-0.5 rounded border ${job.type === 'Shorts' ? 'bg-purple-900/20 text-purple-400 border-purple-900/50' : 'bg-blue-900/20 text-blue-400 border-blue-900/50'}`}>{job.type}</span></td>
                                  <td className="p-4"><div className="flex items-center gap-2">{getStatusBadge(job.status)}<span className="text-xs text-slate-500 font-mono">{job.progress}%</span></div></td>
                                  <td className="p-4">{getPublishStatus(job)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      )}
    </div>
  );
};

export default Automations;
