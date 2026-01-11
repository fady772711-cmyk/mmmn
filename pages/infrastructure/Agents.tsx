
import React, { useState, useEffect } from 'react';
import { AgentRole, AgentConfiguration, ProviderConfig } from '../../types';
import { AgentRegistry } from '../../services/agentRegistry';
import { db } from '../../services/storageService';
import { Bot, Terminal, CheckCircle2, Settings, Edit3, X, Save, Cpu } from 'lucide-react';
import InlineCopilot from '../../components/InlineCopilot';

const Agents: React.FC = () => {
  const [activeRole, setActiveRole] = useState<AgentRole | null>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [configs, setConfigs] = useState<AgentConfiguration[]>([]);
  
  // Editor State
  const [editConfig, setEditConfig] = useState<AgentConfiguration | null>(null);

  useEffect(() => {
    const load = async () => {
        const provs = await db.getProviders();
        const confs = await db.getAgentConfigs();
        setProviders(provs.filter(p => p.type === 'LLM'));
        setConfigs(confs);
    };
    load();
  }, [activeRole]); // Reload when modal closes to reflect copilot changes

  const handleEdit = (role: AgentRole) => {
      const existing = configs.find(c => c.agentRole === role);
      if (existing) {
          setEditConfig(existing);
      } else {
          setEditConfig({
              agentRole: role,
              providerId: 'gemini',
              modelId: 'gemini-3-flash-preview',
              customSystemInstruction: '',
              temperature: 0.7
          });
      }
      setActiveRole(role);
  };

  const handleSave = async () => {
      if (editConfig) {
          await db.saveAgentConfig(editConfig);
          const newConfigs = await db.getAgentConfigs();
          setConfigs(newConfigs);
          setActiveRole(null);
      }
  };

  // --- COPILOT INTEGRATION ---
  const handleCopilotAction = async (action: string, payload: any) => {
      if (action === 'optimize_agent') {
          // Payload: { role, suggestedInstruction, suggestedModel, reasoning }
          const role = payload.role as AgentRole;
          
          // Save the optimization directly
          const newConfig: AgentConfiguration = {
              agentRole: role,
              providerId: 'gemini', // Default to gemini usually
              modelId: payload.suggestedModel || 'gemini-3-pro-preview',
              customSystemInstruction: payload.suggestedInstruction,
              temperature: 0.7
          };
          
          await db.saveAgentConfig(newConfig);
          
          // Refresh list
          const newConfigs = await db.getAgentConfigs();
          setConfigs(newConfigs);
          
          alert(`تم تحديث الوكيل ${role} بنجاح!\nالسبب: ${payload.reasoning}`);
      }
  };

  const AGENT_ARCHITECT_PROMPT = `You are an AI Architect Agent.
  Your goal: Optimize other agents.
  Available Agents: ${Object.keys(AgentRegistry).join(', ')}.
  Available Models: 'gemini-3-pro-preview' (Best for reasoning), 'gemini-3-flash-preview' (Fast), 'gemini-2.5-flash'.
  
  User Request: "Make the ScriptBuilder more creative and funny".
  Action: 'optimize_agent'
  Payload: {
    "role": "ScriptBuilder",
    "suggestedModel": "gemini-3-pro-preview",
    "suggestedInstruction": "You are a Comedy Scriptwriter. Use humor, wit, and punchlines. ... [Full Prompt]",
    "reasoning": "Switched to Pro model for better nuance and added comedy persona instructions."
  }
  
  User Request: "The Strategy Agent is too slow".
  Payload: { "role": "StrategyDirector", "suggestedModel": "gemini-3-flash-preview", ... }`;

  const getActiveModelName = (role: AgentRole) => {
      const conf = configs.find(c => c.agentRole === role);
      if (conf) return `${conf.providerId} / ${conf.modelId}`;
      return "Default (Gemini)";
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="flex justify-between items-center mb-6">
            <div>
            <h2 className="text-2xl font-bold text-white">إعدادات الوكلاء (Agents Registry)</h2>
            <p className="text-slate-400">تخصيص الذكاء الاصطناعي لكل مرحلة</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(AgentRegistry).map(([role, agent]) => (
            <div 
                key={role} 
                onClick={() => handleEdit(role as AgentRole)}
                className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col gap-4 group hover:border-blue-500/50 cursor-pointer transition relative overflow-hidden"
            >
                {/* Hover Accent */}
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition"></div>

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-200 text-sm">{agent.name}</h3>
                            <span className="text-[10px] font-mono text-slate-500">{role}</span>
                        </div>
                    </div>
                    <Edit3 size={16} className="text-slate-600 group-hover:text-blue-400" />
                </div>

                <p className="text-slate-400 text-xs h-10 line-clamp-2">{agent.description}</p>
                
                <div className="mt-auto pt-3 border-t border-slate-800 flex justify-between items-center">
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Cpu size={12} />
                        <span className="text-blue-400">{getActiveModelName(role as AgentRole)}</span>
                    </div>
                    {/* Visual indicator if customized */}
                    {configs.find(c => c.agentRole === role) && (
                        <span className="text-[10px] bg-purple-900/30 text-purple-400 px-2 rounded">Customized</span>
                    )}
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* Copilot Sidebar */}
      <div className="w-80 shrink-0">
          <InlineCopilot 
              title="Agent Architect"
              subtitle="خبير تطوير الوكلاء"
              systemPrompt={AGENT_ARCHITECT_PROMPT}
              placeholder="مثال: اجعل وكيل السكربت أكثر كوميدية..."
              onAction={handleCopilotAction}
          />
      </div>

      {/* EDIT MODAL */}
      {activeRole && editConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-600 p-2 rounded-lg text-white">
                              <Settings size={20} />
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-white">تطوير الوكيل: {AgentRegistry[activeRole].name}</h3>
                              <p className="text-xs text-slate-400">تعديل الموديل والتعليمات البرمجية (System Prompt)</p>
                          </div>
                      </div>
                      <button onClick={() => setActiveRole(null)} className="text-slate-500 hover:text-white transition">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                      
                      {/* 1. Model Selection */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">المزود (Provider)</label>
                              <select 
                                value={editConfig.providerId}
                                onChange={e => {
                                    const provider = providers.find(p => p.providerId === e.target.value);
                                    setEditConfig({
                                        ...editConfig, 
                                        providerId: e.target.value,
                                        modelId: provider?.models?.[0] || '' // Reset model when provider changes
                                    });
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-sm"
                              >
                                  {providers.map(p => (
                                      <option key={p.id} value={p.providerId}>{p.name} ({p.status})</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">الموديل (Model)</label>
                              <select 
                                value={editConfig.modelId}
                                onChange={e => setEditConfig({...editConfig, modelId: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-sm"
                              >
                                  {providers.find(p => p.providerId === editConfig.providerId)?.models?.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                  )) || <option value="">No models available</option>}
                              </select>
                          </div>
                      </div>

                      {/* 2. Parameters */}
                      <div>
                          <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">درجة الإبداع (Temperature: {editConfig.temperature})</label>
                          <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-500">منطقي (0.0)</span>
                              <input 
                                type="range" min="0" max="1" step="0.1"
                                value={editConfig.temperature}
                                onChange={e => setEditConfig({...editConfig, temperature: parseFloat(e.target.value)})}
                                className="flex-1 accent-blue-600 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs text-slate-500">إبداعي (1.0)</span>
                          </div>
                      </div>

                      {/* 3. System Instruction */}
                      <div>
                          <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">التعليمات المخصصة (Custom System Instruction)</label>
                          <textarea 
                            value={editConfig.customSystemInstruction}
                            onChange={e => setEditConfig({...editConfig, customSystemInstruction: e.target.value})}
                            placeholder="اكتب تعليمات مخصصة هنا لتجاوز التعليمات الافتراضية للنظام... (اتركها فارغة لاستخدام الافتراضي)"
                            className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono leading-relaxed focus:border-blue-500 outline-none"
                          />
                          <p className="text-xs text-slate-500 mt-2">
                              ملاحظة: هذا النص سيتم إرساله للموديل كـ "System Prompt". استخدمه لتحسين أسلوب الكتابة أو إضافة قواعد صارمة.
                          </p>
                      </div>

                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950 rounded-b-xl flex justify-end gap-3">
                      <button onClick={() => setActiveRole(null)} className="px-4 py-2 text-slate-400 hover:text-white transition">إلغاء</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 transition">
                          <Save size={18} /> حفظ التعديلات
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agents;
