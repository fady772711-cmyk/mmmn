import React from 'react';
import { AgentRole } from '../../types';
import { AgentRegistry } from '../../services/agentRegistry';
import { Bot, Terminal, CheckCircle2 } from 'lucide-react';

const Agents: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">إدارة الوكلاء (Agents Registry)</h2>
          <p className="text-slate-400">تعريف ومراقبة الوكلاء الذكيين في النظام</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Object.entries(AgentRegistry).map(([role, agent]) => (
          <div key={role} className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-slate-200">{agent.name}</h3>
                    <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">{role}</span>
                </div>
                <div className="flex items-center gap-2 text-green-500 text-sm">
                    <CheckCircle2 size={16} />
                    <span>Active</span>
                </div>
              </div>
              <p className="text-slate-400 mt-2 text-sm">{agent.description}</p>
              
              <div className="mt-4 pt-4 border-t border-slate-800 flex gap-4">
                  <div className="text-xs">
                      <span className="text-slate-500 block">Model</span>
                      <span className="text-slate-300">Gemini 2.0 Flash</span>
                  </div>
                  <div className="text-xs">
                      <span className="text-slate-500 block">Capabilities</span>
                      <span className="text-slate-300">
                          {role.includes('VOICE') ? 'TTS Generation' : 
                           role.includes('VISUAL') ? 'Image Generation' : 'Text Processing'}
                      </span>
                  </div>
              </div>
            </div>
            <button className="self-center p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Test Agent">
                <Terminal size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Agents;