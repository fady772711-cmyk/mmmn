
import React, { useState, useEffect } from 'react';
import { 
    BrainCircuit, Terminal, Play, Loader2, CheckCircle2, 
    AlertCircle, FileText, Activity, Layers, Code, Zap
} from 'lucide-react';
import { server } from '../services/serverOrchestrator';
import { AdminScope, AdminJob, AdminTask } from '../types';

const AdminAgent: React.FC = () => {
    const [brief, setBrief] = useState('');
    const [selectedScopes, setSelectedScopes] = useState<AdminScope[]>(['Production']);
    const [isRunning, setIsRunning] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [adminJob, setAdminJob] = useState<AdminJob | null>(null);

    const scopesList: { id: AdminScope; label: string; icon: any }[] = [
        { id: 'Production', label: 'Video Production', icon: Layers },
        { id: 'Analytics', label: 'Channel Analytics', icon: Activity },
        { id: 'Automation', label: 'Automation Rules', icon: Zap },
        { id: 'UI', label: 'UI & Dashboard', icon: FileText },
        { id: 'DevOps', label: 'System/DevOps', icon: Code },
    ];

    // Polling Loop
    useEffect(() => {
        let interval: any;
        if (jobId && isRunning) {
            interval = setInterval(async () => {
                const status = await server.getAdminJobStatus(jobId);
                if (status) {
                    setAdminJob(status);
                    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                        setIsRunning(false);
                        clearInterval(interval);
                    }
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [jobId, isRunning]);

    const handleRun = async () => {
        if (!brief.trim()) return alert("Please enter a brief.");
        
        setIsRunning(true);
        setAdminJob(null); // Reset UI
        
        try {
            const newId = await server.runAdminAgent(brief, selectedScopes, 'Normal');
            setJobId(newId);
        } catch (e: any) {
            alert("Failed to start Admin Agent: " + e.message);
            setIsRunning(false);
        }
    };

    const toggleScope = (scope: AdminScope) => {
        setSelectedScopes(prev => 
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    };

    return (
        <div className="flex h-[calc(100vh-80px)] -m-6">
            {/* LEFT: Input Control */}
            <div className="w-1/3 bg-slate-950 border-r border-slate-800 p-6 flex flex-col">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="text-purple-500" /> 
                        Admin Agent
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Central Command: Define your high-level goal, and the system will orchestrate the execution.
                    </p>
                </div>

                <div className="space-y-6 flex-1">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Objective Brief</label>
                        <textarea 
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            placeholder="e.g., Create a daily schedule for 'Horror Shorts' about urban legends, analyze the current trend, and prepare the first video."
                            className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:border-purple-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Operational Scope</label>
                        <div className="grid grid-cols-2 gap-3">
                            {scopesList.map(scope => {
                                const Icon = scope.icon;
                                const isSelected = selectedScopes.includes(scope.id);
                                return (
                                    <button
                                        key={scope.id}
                                        onClick={() => toggleScope(scope.id)}
                                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                                            isSelected 
                                            ? 'bg-purple-900/20 border-purple-500 text-purple-400' 
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        <span>{scope.label}</span>
                                        {isSelected && <CheckCircle2 size={14} className="ml-auto" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800">
                    <button 
                        onClick={handleRun}
                        disabled={isRunning || !brief}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-purple-900/20"
                    >
                        {isRunning ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                        <span>Run Admin Agent</span>
                    </button>
                </div>
            </div>

            {/* RIGHT: Live Monitor */}
            <div className="w-2/3 bg-slate-900 p-8 overflow-y-auto flex flex-col gap-6">
                {!adminJob ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                        <Terminal size={64} className="mb-4" />
                        <p className="text-lg">Waiting for command...</p>
                    </div>
                ) : (
                    <>
                        {/* Header Status */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white">Execution Monitor</h3>
                                <p className="text-xs text-slate-400 font-mono">Job ID: {adminJob.id}</p>
                            </div>
                            <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                                adminJob.status === 'EXECUTING' || adminJob.status === 'PLANNING' ? 'bg-blue-900/20 text-blue-400 border-blue-500/50' :
                                adminJob.status === 'COMPLETED' ? 'bg-green-900/20 text-green-400 border-green-500/50' :
                                'bg-red-900/20 text-red-400 border-red-500/50'
                            }`}>
                                {adminJob.status}
                            </div>
                        </div>

                        {/* Decisions Log (The Brain) */}
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs max-h-48 overflow-y-auto">
                            <h4 className="text-slate-500 uppercase font-bold mb-2 flex items-center gap-2">
                                <BrainCircuit size={14} /> Decision Log
                            </h4>
                            <div className="space-y-1">
                                {adminJob.decisionsLog.map((log, i) => (
                                    <div key={i} className="text-slate-300 border-l-2 border-slate-800 pl-2 py-0.5">
                                        {log}
                                    </div>
                                ))}
                                {adminJob.status === 'PLANNING' && (
                                    <div className="text-blue-400 animate-pulse">Thinking...</div>
                                )}
                            </div>
                        </div>

                        {/* Execution Plan (Tasks) */}
                        <div className="flex-1 space-y-4">
                            <h4 className="text-slate-500 uppercase font-bold text-sm">Execution Plan</h4>
                            {adminJob.executionPlan.length === 0 && adminJob.status === 'PLANNING' && (
                                <div className="p-4 border border-dashed border-slate-800 rounded-lg text-center text-slate-500">
                                    Formulating plan...
                                </div>
                            )}
                            {adminJob.executionPlan.map((task: AdminTask, idx) => (
                                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-4">
                                    <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                                        task.status === 'COMPLETED' ? 'bg-green-500/10 border-green-500 text-green-500' :
                                        task.status === 'RUNNING' ? 'bg-blue-500/10 border-blue-500 text-blue-500 animate-pulse' :
                                        task.status === 'FAILED' ? 'bg-red-500/10 border-red-500 text-red-500' :
                                        'border-slate-700 text-slate-700'
                                    }`}>
                                        {task.status === 'COMPLETED' ? <CheckCircle2 size={14} /> : 
                                         task.status === 'FAILED' ? <AlertCircle size={14} /> :
                                         <div className="w-2 h-2 bg-current rounded-full" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h5 className="font-bold text-slate-200">{task.title}</h5>
                                            <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-400">
                                                {task.targetSystem}
                                            </span>
                                        </div>
                                        {task.result && (
                                            <div className="mt-2 bg-slate-900 p-3 rounded text-xs text-slate-300 border border-slate-800">
                                                <span className="text-green-500 font-bold mr-2">Result:</span>
                                                {task.result}
                                            </div>
                                        )}
                                        {task.status === 'RUNNING' && (
                                            <div className="mt-2 text-xs text-blue-400 flex items-center gap-2">
                                                <Loader2 size={10} className="animate-spin" /> Processing remotely...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Final Output */}
                        {adminJob.finalOutput && (
                            <div className="bg-green-900/10 border border-green-900/30 rounded-xl p-6">
                                <h4 className="font-bold text-green-400 mb-2">Final Report</h4>
                                <p className="text-sm text-slate-300">
                                    {adminJob.finalOutput.summary}
                                </p>
                                <div className="text-xs text-slate-500 mt-2 text-right">
                                    Completed at: {new Date(adminJob.finalOutput.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminAgent;
