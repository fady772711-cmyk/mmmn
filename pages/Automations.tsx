
import React, { useState, useEffect } from 'react';
import { 
    AutomationConfig, Channel, ProviderConfig, 
    AutomationAgentConfig, AutomationVideoSpecs, AutomationVisualConfig, AutomationScheduleConfig,
    VoicePreset, AutomationVoiceSettings
} from '../types';
import { db } from '../services/storageService';
import { 
    Workflow, Play, Pause, Trash2, Plus, ArrowRight, CheckCircle2, 
    AlertTriangle, ShieldAlert, MonitorPlay, Smartphone, Bot, Clock, 
    Image as ImageIcon, Video, Mic, Calendar, Youtube, Save, X, Activity, Type as TypeIcon, Layers, Settings2
} from 'lucide-react';

const FEATURE_AUTOMATIONS = true;

const Automations: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationConfig[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Builder State
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New Automation Configuration State
  const [config, setConfig] = useState<Partial<AutomationConfig>>({
      isEnabled: false,
      agents: {
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
      publishMode: 'Private'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [auths, chans, provs, voicesData] = await Promise.all([
        db.getAutomations(),
        db.getChannels(),
        db.getProviders(),
        db.getVoices()
    ]);
    setAutomations(auths);
    setChannels(chans);
    setProviders(provs);
    setVoices(voicesData);
    setLoading(false);
  };

  // --- Step Logic ---

  const validateStep = (step: number): boolean => {
      setValidationError(null);
      switch(step) {
          case 1: // Target Channel
              if (!config.channelId) { setValidationError("يجب اختيار قناة."); return false; }
              return true;
          case 2: // Production Line
              if (!config.pipelineLine) { setValidationError("يجب اختيار خط إنتاج."); return false; }
              return true;
          case 5: // Visuals
              // Check if provider key exists
              if (config.visuals?.provider.includes('veo')) {
                  const hasGemini = providers.some(p => p.providerId === 'gemini' && p.status === 'operational');
                  if (!hasGemini) { setValidationError("يتطلب Veo مفتاح Gemini API فعال."); return false; }
              }
              return true;
          case 8: // Publishing
              const ch = channels.find(c => c.id === config.channelId);
              if (!ch?.linkedYouTubeChannel) { 
                  setValidationError("القناة غير مرتبطة بحساب YouTube. اذهب لإعدادات القناة لربطها."); 
                  return false; 
              }
              return true;
          default:
              return true;
      }
  };

  const nextStep = () => {
      if (validateStep(activeStep)) {
          setActiveStep(prev => Math.min(prev + 1, 8));
      }
  };

  const prevStep = () => setActiveStep(prev => Math.max(prev - 1, 1));

  const handleSave = async () => {
      if (!validateStep(8)) return;

      const newAuth: AutomationConfig = {
          id: config.id || `auto_${Date.now()}`,
          name: `${channels.find(c => c.id === config.channelId)?.name} - ${config.pipelineLine}`,
          channelId: config.channelId!,
          pipelineLine: config.pipelineLine!,
          isEnabled: config.isEnabled || false,
          agents: config.agents as AutomationAgentConfig,
          specs: config.specs as AutomationVideoSpecs,
          visuals: config.visuals as AutomationVisualConfig,
          voiceSettings: config.voiceSettings as AutomationVoiceSettings,
          schedule: config.schedule as AutomationScheduleConfig,
          publishMode: config.publishMode!,
          
          // Legacy Mappings
          videosPerDay: config.specs?.videosPerDay,
          scheduleTimes: config.schedule?.times,
          planningMode: config.schedule?.useAdminPlanner ? 'Agent' : 'Manual'
      };

      await db.saveAutomation(newAuth);
      await loadData();
      setIsBuilding(false);
      setConfig({}); // Reset
      setActiveStep(1);
  };

  const handleDelete = async (id: string) => {
      if (confirm("هل أنت متأكد من حذف هذه الأتمتة؟")) {
          await db.deleteAutomation(id);
          await loadData();
      }
  };

  // --- Render Steps ---

  const renderStepContent = () => {
      switch(activeStep) {
          case 1: // Target Channel
              return (
                  <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Activity /> اختر القناة المستهدفة</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {channels.map(ch => (
                              <div 
                                key={ch.id} 
                                onClick={() => setConfig({...config, channelId: ch.id})}
                                className={`p-4 rounded-xl border cursor-pointer transition ${config.channelId === ch.id ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                              >
                                  <div className="font-bold text-slate-200">{ch.name}</div>
                                  <div className="text-xs text-slate-500 mt-1">{ch.language} • {ch.tone}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              );
          case 2: // Production Line
              return (
                  <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Workflow /> خط الإنتاج (Pipeline)</h3>
                      <div className="grid grid-cols-3 gap-4">
                          {[
                              { id: 'Shorts', label: 'Shorts (Vertical)', icon: Smartphone, desc: 'فيديوهات قصيرة سريعة الانتشار' },
                              { id: 'Long Narrative', label: 'Long Narrative', icon: MonitorPlay, desc: 'قصص وثائقية طويلة' },
                              { id: 'Long Explainer', label: 'Long Explainer', icon: MonitorPlay, desc: 'شروحات تعليمية مفصلة' }
                          ].map(line => (
                              <div 
                                key={line.id}
                                onClick={() => {
                                    const isShorts = line.id === 'Shorts';
                                    setConfig({
                                        ...config, 
                                        pipelineLine: line.id as any,
                                        specs: { ...config.specs!, durationUnit: isShorts ? 'seconds' : 'minutes', targetDuration: isShorts ? 45 : 8 },
                                        visuals: { 
                                            ...config.visuals!, 
                                            mode: isShorts ? 'video' : 'images', 
                                            provider: isShorts ? 'veo_3_1_fast' : 'nano_banana',
                                            enableTextOverlay: isShorts // Auto-enable text for shorts
                                        }
                                    });
                                }}
                                className={`p-6 rounded-xl border cursor-pointer flex flex-col items-center text-center transition ${config.pipelineLine === line.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
                              >
                                  <div className={`p-3 rounded-full mb-3 ${config.pipelineLine === line.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                      <line.icon size={24} />
                                  </div>
                                  <div className="font-bold text-slate-200">{line.label}</div>
                                  <div className="text-xs text-slate-500 mt-2">{line.desc}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              );
          case 3: // Agents
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bot /> تكوين الوكلاء (Agents Configuration)</h3>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                          {Object.keys(config.agents!).map((key) => (
                              <div key={key} className="p-4 flex items-center justify-between">
                                  <span className="capitalize text-slate-300 font-medium">{key} Agent</span>
                                  <div className="flex bg-slate-950 rounded p-1 border border-slate-700">
                                      {['auto', 'manual', 'skip'].map(mode => (
                                          <button 
                                            key={mode}
                                            onClick={() => setConfig({...config, agents: { ...config.agents!, [key]: mode }})}
                                            className={`px-3 py-1 rounded text-xs capitalize ${config.agents![key as keyof AutomationAgentConfig] === mode ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                                          >
                                              {mode}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              );
          case 4: // Specs
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock /> مواصفات الفيديو</h3>
                      <div className="grid grid-cols-2 gap-6">
                          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                              <label className="block text-slate-400 mb-2">المدة المستهدفة ({config.specs?.durationUnit})</label>
                              <input 
                                type="number" 
                                value={config.specs?.targetDuration}
                                onChange={e => setConfig({...config, specs: { ...config.specs!, targetDuration: parseInt(e.target.value) }})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-lg"
                              />
                          </div>
                          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                              <label className="block text-slate-400 mb-2">عدد الفيديوهات يومياً</label>
                              <input 
                                type="number" 
                                value={config.specs?.videosPerDay}
                                onChange={e => setConfig({...config, specs: { ...config.specs!, videosPerDay: parseInt(e.target.value) }})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-lg"
                              />
                          </div>
                      </div>
                  </div>
              );
          case 5: // Visual Provider (Enhanced)
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><ImageIcon /> إعدادات المشاهد المرئية</h3>
                      
                      <div className="grid grid-cols-2 gap-6">
                          {/* 1. Visual Mode & Provider */}
                          <div className="space-y-4">
                              <div className="space-y-2">
                                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">نوع المحتوى (Visual Mode)</label>
                                  <div className="flex gap-2">
                                      {['images', 'video', 'mixed'].map(m => (
                                          <button 
                                            key={m}
                                            onClick={() => setConfig({...config, visuals: { ...config.visuals!, mode: m as any }})}
                                            className={`flex-1 py-2.5 rounded border text-sm capitalize ${config.visuals?.mode === m ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                                          >
                                              {m}
                                          </button>
                                      ))}
                                  </div>
                              </div>

                              <div className="space-y-2">
                                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">نموذج التوليد (AI Model)</label>
                                  <select 
                                    value={config.visuals?.provider}
                                    onChange={e => setConfig({...config, visuals: { ...config.visuals!, provider: e.target.value as any }})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white text-sm"
                                  >
                                      <optgroup label="Image Models">
                                          <option value="nano_banana">Gemini Flash Image (Fastest)</option>
                                          <option value="imagen_3">Imagen 3 (High Quality)</option>
                                      </optgroup>
                                      <optgroup label="Video Models">
                                          <option value="veo_3_1_fast">Veo 3.1 Fast (Recommended)</option>
                                          <option value="veo_2">Veo 2.0 (Legacy)</option>
                                      </optgroup>
                                  </select>
                              </div>
                          </div>

                          {/* 2. Text Overlay Settings */}
                          <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                              <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-slate-300 font-medium">
                                      <TypeIcon size={18} className="text-blue-500" />
                                      عرض النصوص (Text Overlay)
                                  </label>
                                  <div 
                                    onClick={() => setConfig({...config, visuals: { ...config.visuals!, enableTextOverlay: !config.visuals?.enableTextOverlay }})}
                                    className={`w-10 h-6 rounded-full flex items-center p-1 cursor-pointer transition ${config.visuals?.enableTextOverlay ? 'bg-blue-600' : 'bg-slate-700'}`}
                                  >
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition ${config.visuals?.enableTextOverlay ? 'translate-x-4' : 'translate-x-0'}`} />
                                  </div>
                              </div>

                              {config.visuals?.enableTextOverlay && (
                                  <div className="space-y-2 pt-2 border-t border-slate-800">
                                      <label className="text-xs text-slate-500 block">طريقة العرض (Style)</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          {['cinematic', 'subtitles', 'minimal', 'bold'].map(style => (
                                              <button 
                                                key={style}
                                                onClick={() => setConfig({...config, visuals: { ...config.visuals!, textOverlayStyle: style as any }})}
                                                className={`px-3 py-2 rounded text-xs border ${config.visuals?.textOverlayStyle === style ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-700 text-slate-400'}`}
                                              >
                                                  {style}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* 3. Image Quantity (Only for Image/Mixed Mode) */}
                      {config.visuals?.mode !== 'video' && (
                          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <Layers className="text-slate-500" size={20} />
                                  <div>
                                      <label className="block text-slate-300 font-medium text-sm">عدد الصور المقترحة</label>
                                      <p className="text-xs text-slate-500">حدد كثافة الصور في الفيديو</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 bg-slate-950 p-1 rounded border border-slate-700">
                                  <button 
                                    onClick={() => setConfig({...config, visuals: { ...config.visuals!, imageQuantityMode: 'auto' }})}
                                    className={`px-3 py-1.5 rounded text-xs ${config.visuals?.imageQuantityMode === 'auto' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                  >
                                      Automatic (AI)
                                  </button>
                                  <div className="flex items-center border-l border-slate-800 pl-2">
                                      <button 
                                        onClick={() => setConfig({...config, visuals: { ...config.visuals!, imageQuantityMode: 'custom' }})}
                                        className={`px-3 py-1.5 rounded text-xs ${config.visuals?.imageQuantityMode === 'custom' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                      >
                                          Custom
                                      </button>
                                      {config.visuals?.imageQuantityMode === 'custom' && (
                                          <input 
                                            type="number" 
                                            min="5" max="50"
                                            value={config.visuals?.imageQuantity || 10}
                                            onChange={e => setConfig({...config, visuals: { ...config.visuals!, imageQuantityMode: 'custom', imageQuantity: parseInt(e.target.value) }})}
                                            className="w-12 bg-slate-900 border border-slate-700 rounded text-center text-xs ml-2 py-1 text-white outline-none focus:border-blue-500"
                                          />
                                      )}
                                  </div>
                              </div>
                          </div>
                      )}

                      {config.visuals?.provider.includes('veo') && (
                          <div className="flex items-center gap-2 text-amber-500 bg-amber-900/10 p-3 rounded border border-amber-900/30">
                              <AlertTriangle size={18} />
                              <span className="text-sm">Video Generation uses significantly more tokens and time. Ensure fallback is configured.</span>
                          </div>
                      )}
                  </div>
              );
          case 6: // Voice & Music (Enhanced)
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Mic /> الصوت والموسيقى</h3>
                      
                      {/* Voice Settings */}
                      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                              <div className="flex items-center gap-4">
                                  <div className="bg-green-500/10 p-3 rounded-full text-green-500"><Mic /></div>
                                  <div>
                                      <div className="font-bold text-white">Voice Director</div>
                                      <div className="text-xs text-slate-500">إعدادات التعليق الصوتي</div>
                                  </div>
                              </div>
                              <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded text-xs border border-slate-700">LOCKED ON</span>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                              <div>
                                  <label className="text-xs text-slate-500 font-bold block mb-2">نوع الصوت (Voice Preset)</label>
                                  <select 
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                                    value={config.voiceSettings?.mode === 'auto_match_channel' ? 'auto' : config.voiceSettings?.voicePresetId}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === 'auto') {
                                            setConfig({...config, voiceSettings: { ...config.voiceSettings!, mode: 'auto_match_channel' }});
                                        } else {
                                            setConfig({...config, voiceSettings: { ...config.voiceSettings!, mode: 'specific_preset', voicePresetId: val }});
                                        }
                                    }}
                                  >
                                      <option value="auto">⚡ Auto Match Channel Tone</option>
                                      <optgroup label="My Voices Library">
                                          {voices.map(v => (
                                              <option key={v.id} value={v.id}>{v.name} ({v.gender} - {v.languageCode})</option>
                                          ))}
                                      </optgroup>
                                  </select>
                              </div>

                              <div>
                                  <label className="text-xs text-slate-500 font-bold block mb-2">سرعة الإلقاء (Speed: {config.voiceSettings?.speed}x)</label>
                                  <div className="flex items-center gap-3">
                                      <span className="text-xs text-slate-500">Slow</span>
                                      <input 
                                        type="range" 
                                        min="0.8" max="1.2" step="0.1"
                                        value={config.voiceSettings?.speed || 1.0}
                                        onChange={e => setConfig({...config, voiceSettings: { ...config.voiceSettings!, speed: parseFloat(e.target.value) }})}
                                        className="flex-1 accent-blue-600 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                      />
                                      <span className="text-xs text-slate-500">Fast</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Music Settings */}
                      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                  <div className="bg-purple-500/10 p-3 rounded-full text-purple-500"><MonitorPlay /></div>
                                  <div className="font-bold text-white">Music Director</div>
                              </div>
                              <div className="flex bg-slate-950 rounded p-1 border border-slate-700">
                                  {['auto', 'off', 'manual'].map(m => (
                                      <button 
                                        key={m}
                                        onClick={() => setConfig({...config, agents: { ...config.agents!, music: m as any }})}
                                        className={`px-4 py-1.5 rounded text-xs capitalize ${config.agents?.music === m ? 'bg-purple-600 text-white' : 'text-slate-500'}`}
                                      >
                                          {m}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          {config.agents?.music === 'auto' && (
                              <p className="text-xs text-slate-500 pl-16">
                                  MusicDirector سيقوم باختيار مقطوعة من مكتبة YouTube Audio Library ودمجها مع التعليق الصوتي تلقائياً.
                              </p>
                          )}
                      </div>
                  </div>
              );
          case 7: // Schedule
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Calendar /> الجدولة والتخطيط</h3>
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                              <label className="text-slate-400 text-sm block mb-2">Timezone</label>
                              <select 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                                value={config.schedule?.timezone}
                                onChange={e => setConfig({...config, schedule: { ...config.schedule!, timezone: e.target.value }})}
                              >
                                  <option value="Asia/Riyadh">Asia/Riyadh (KSA)</option>
                                  <option value="Africa/Cairo">Africa/Cairo (Egypt)</option>
                                  <option value="UTC">UTC</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-slate-400 text-sm block mb-2">Start Date</label>
                              <input 
                                type="date"
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                                value={config.schedule?.startDate}
                                onChange={e => setConfig({...config, schedule: { ...config.schedule!, startDate: e.target.value }})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="text-slate-400 text-sm block mb-2">Publish Times</label>
                          <div className="flex flex-wrap gap-2">
                              {config.schedule?.times.map((t, i) => (
                                  <span key={i} className="bg-slate-800 text-white px-3 py-1 rounded border border-slate-700 flex items-center gap-2">
                                      {t} <button onClick={() => {
                                          const newTimes = config.schedule!.times.filter((_, idx) => idx !== i);
                                          setConfig({...config, schedule: { ...config.schedule!, times: newTimes }});
                                      }}><X size={12} /></button>
                                  </span>
                              ))}
                              <button 
                                onClick={() => {
                                    const time = prompt("Enter time (HH:MM)");
                                    if(time) setConfig({...config, schedule: { ...config.schedule!, times: [...config.schedule!.times, time] }});
                                }}
                                className="bg-slate-800 text-blue-400 px-3 py-1 rounded border border-dashed border-slate-600 hover:border-blue-500"
                              >
                                  + Add Time
                              </button>
                          </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800">
                          <label className="flex items-center gap-3 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={config.schedule?.useAdminPlanner}
                                onChange={e => setConfig({...config, schedule: { ...config.schedule!, useAdminPlanner: e.target.checked }})}
                                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                              />
                              <div>
                                  <span className="block text-white font-bold">Use AdminPlanner Agent</span>
                                  <span className="block text-xs text-slate-500">Automatically generate topics based on trends daily.</span>
                              </div>
                          </label>
                      </div>
                  </div>
              );
          case 8: // Publishing
              const ch = channels.find(c => c.id === config.channelId);
              return (
                  <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Youtube /> النشر النهائي</h3>
                      
                      <div className={`p-6 rounded-xl border flex items-start gap-4 ${ch?.linkedYouTubeChannel ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                          {ch?.linkedYouTubeChannel ? <CheckCircle2 className="text-green-500" /> : <AlertTriangle className="text-red-500" />}
                          <div>
                              <div className="font-bold text-white">YouTube Integration</div>
                              <div className="text-sm text-slate-400 mt-1">
                                  {ch?.linkedYouTubeChannel ? `Connected: ${ch.linkedYouTubeChannel.title}` : 'No Channel Linked'}
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="text-slate-400 text-sm block mb-2">Privacy Status</label>
                          <select 
                            value={config.publishMode}
                            onChange={e => setConfig({...config, publishMode: e.target.value as any})}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                          >
                              <option value="Draft">Draft (Upload but don't publish)</option>
                              <option value="Private">Private</option>
                              <option value="Scheduled">Scheduled (Using YouTube Scheduler)</option>
                          </select>
                      </div>
                  </div>
              );
          default: return null;
      }
  };

  const StepsIndicator = () => (
      <div className="flex items-center justify-between mb-8 px-2 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-10"></div>
          {[1,2,3,4,5,6,7,8].map(s => {
              const active = s <= activeStep;
              const current = s === activeStep;
              return (
                  <div key={s} className={`flex flex-col items-center gap-2 ${active ? 'text-blue-500' : 'text-slate-600'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          current ? 'bg-blue-600 text-white border-blue-600 scale-110' : 
                          active ? 'bg-slate-950 border-blue-600' : 'bg-slate-950 border-slate-800'
                      }`}>
                          {s}
                      </div>
                  </div>
              );
          })}
      </div>
  );

  if (!FEATURE_AUTOMATIONS) return <div className="p-10 text-center text-slate-500">Feature Disabled</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">الأتمتة والجدولة (Pipeline Builder)</h2>
          <p className="text-slate-400">بناء خطوط إنتاج مؤتمتة بالكامل</p>
        </div>
        {!isBuilding && (
            <button onClick={() => setIsBuilding(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                <Plus size={18} />
                <span>قاعدة جديدة</span>
            </button>
        )}
      </div>

      {isBuilding ? (
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[600px]">
              {/* Header */}
              <div className="bg-slate-900 p-6 border-b border-slate-800">
                  <StepsIndicator />
              </div>

              {/* Body */}
              <div className="flex-1 p-8 grid grid-cols-3 gap-8">
                  {/* Form Area */}
                  <div className="col-span-2">
                      {renderStepContent()}
                      {validationError && (
                          <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 rounded flex items-center gap-2">
                              <ShieldAlert size={18} /> {validationError}
                          </div>
                      )}
                  </div>

                  {/* Sidebar Summary */}
                  <div className="bg-slate-900/50 border-r border-slate-800 -my-8 -mr-8 p-6 space-y-4">
                      <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800 pb-2">Configuration Summary</h4>
                      <div className="space-y-3 text-sm">
                          <div>
                              <span className="block text-slate-500 text-xs">Channel</span>
                              <span className="text-slate-200">{channels.find(c => c.id === config.channelId)?.name || '-'}</span>
                          </div>
                          <div>
                              <span className="block text-slate-500 text-xs">Pipeline</span>
                              <span className="text-slate-200">{config.pipelineLine || '-'}</span>
                          </div>
                          <div>
                              <span className="block text-slate-500 text-xs">Visuals</span>
                              <span className="text-slate-200">{config.visuals?.provider} / {config.visuals?.mode}</span>
                              <span className="block text-xs text-blue-400 mt-1">
                                  {config.visuals?.enableTextOverlay ? `Text: ${config.visuals.textOverlayStyle}` : 'No Text'}
                              </span>
                          </div>
                          <div>
                              <span className="block text-slate-500 text-xs">Voice</span>
                              <span className="text-slate-200">
                                  {config.voiceSettings?.mode === 'auto_match_channel' ? 'Auto Match' : 'Specific Preset'}
                              </span>
                          </div>
                          <div>
                              <span className="block text-slate-500 text-xs">Schedule</span>
                              <span className="text-slate-200">{config.schedule?.times.length} videos @ {config.schedule?.days.length} days/week</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 flex justify-between bg-slate-900">
                  <button onClick={() => { setIsBuilding(false); setConfig({}); setActiveStep(1); }} className="px-6 py-2 text-slate-400 hover:text-white">Cancel</button>
                  <div className="flex gap-3">
                      <button onClick={prevStep} disabled={activeStep === 1} className="px-6 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-50">Back</button>
                      {activeStep < 8 ? (
                          <button onClick={nextStep} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex items-center gap-2">
                              Next <ArrowRight size={18} />
                          </button>
                      ) : (
                          <button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold flex items-center gap-2">
                              <Save size={18} /> Finish & Save
                          </button>
                      )}
                  </div>
              </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 gap-4">
              {loading ? <div className="text-center p-8 text-slate-500">Loading...</div> : automations.map(auto => {
                  const channel = channels.find(c => c.id === auto.channelId);
                  return (
                      <div key={auto.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex justify-between items-center group hover:border-slate-700 transition">
                          <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold ${auto.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                  {channel?.name.charAt(0)}
                              </div>
                              <div>
                                  <h3 className="font-bold text-white text-lg">{auto.name}</h3>
                                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                      <span className="bg-slate-800 px-2 py-0.5 rounded">{auto.pipelineLine}</span>
                                      <span>• {auto.specs.videosPerDay} videos/day</span>
                                      <span>• {auto.schedule.useAdminPlanner ? 'Auto-Planned' : 'Manual'}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <button 
                                onClick={() => {
                                    db.saveAutomation({...auto, isEnabled: !auto.isEnabled}).then(loadData);
                                }}
                                className={`p-2 rounded-full border ${auto.isEnabled ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                              >
                                  {auto.isEnabled ? <Pause size={20} /> : <Play size={20} />}
                              </button>
                              <button onClick={() => handleDelete(auto.id)} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-900/10 rounded-full transition">
                                  <Trash2 size={20} />
                              </button>
                          </div>
                      </div>
                  );
              })}
              {automations.length === 0 && !loading && (
                  <div className="text-center p-12 border border-dashed border-slate-800 rounded-xl">
                      <Workflow size={48} className="mx-auto text-slate-700 mb-4" />
                      <p className="text-slate-500">No automation pipelines active.</p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Automations;
