
import React, { useState, useEffect } from 'react';
import { 
    Activity, CheckCircle2, AlertTriangle, 
    Layers, Terminal, TrendingUp, DollarSign, Zap, 
    Video, Cpu, BrainCircuit, Clock, Loader2, Play, Pause, AlertOctagon
} from 'lucide-react';
import { ProductionJob, JobStatus, AgentRole } from '../types';
import { db } from '../services/storageService';

const Dashboard: React.FC = () => {
    // --- State ---
    const [jobs, setJobs] = useState<ProductionJob[]>([]);
    const [agentMetrics, setAgentMetrics] = useState<any[]>([]);
    const [usage, setUsage] = useState<any>({ totalTokens: 0, estimatedCost: 0 });
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // --- Effect: Load Data Live ---
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 3000); // Live refresh every 3s
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            // Fetch directly from DB to avoid API dependency issues on client-side demo
            const [allJobs, allMetrics, globalUsage] = await Promise.all([
                db.getJobs(),
                db.getAgentMetrics(),
                db.getGlobalUsage()
            ]);

            setJobs(allJobs);
            setAgentMetrics(allMetrics);
            setUsage(globalUsage);

            // Extract & Sort logs
            const logs = allJobs
                .flatMap(j => j.logs.map(l => ({ ...l, jobId: j.id, jobTitle: j.title })))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 50);
            setRecentLogs(logs);
            
            setLoading(false);
        } catch (e) {
            console.error("Dashboard data load error", e);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center flex-col gap-4 text-slate-500">
                <Loader2 size={48} className="animate-spin text-blue-600" />
                <p className="font-mono text-sm animate-pulse tracking-widest">INITIALIZING FACTORY OS...</p>
            </div>
        );
    }

    // --- Aggregates ---
    const activeJobs = jobs.filter(j => j.status === JobStatus.RUNNING);
    const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);
    const failedJobs = jobs.filter(j => j.status === JobStatus.FAILED);
    
    // Calculate today's stats
    const today = new Date().toISOString().split('T')[0];
    const jobsToday = completedJobs.filter(j => j.createdAt.startsWith(today));
    
    // --- Components ---

    const KPICard = ({ label, value, sub, icon: Icon, color, trend }: any) => (
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
                <Icon size={80} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
                        <Icon size={18} />
                    </div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-3xl font-bold text-white font-mono mb-1">{value}</div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{sub}</span>
                    {trend && <span className="text-xs text-green-500 font-mono">{trend}</span>}
                </div>
            </div>
        </div>
    );

    const PipelineStage = ({ label, count, active }: { label: string, count: number, active: boolean }) => (
        <div className={`flex-1 flex flex-col items-center gap-2 relative group`}>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</div>
            <div className={`w-full h-2 rounded-full overflow-hidden bg-slate-800 relative`}>
                <div className={`h-full transition-all duration-500 ${active ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} style={{ width: active ? '100%' : '0%' }}></div>
            </div>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold z-10 transition-all ${active ? 'bg-blue-900 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                {count}
            </div>
            {/* Connector Line */}
            <div className="absolute top-7 left-1/2 w-full h-[2px] bg-slate-800 -z-0"></div>
        </div>
    );

    // Map active jobs to pipeline stages
    const pipelineCounts = {
        Strategy: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Strategy') || j.steps[j.currentStepIndex]?.agentRole.includes('Title')).length,
        Scripting: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Script')).length,
        Visuals: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Visual') || j.steps[j.currentStepIndex]?.agentRole.includes('Scene')).length,
        Audio: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Voice') || j.steps[j.currentStepIndex]?.agentRole.includes('Music')).length,
        Assembly: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Editor')).length,
        Publishing: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Publisher')).length,
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            
            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-blue-500" />
                        غرفة العمليات المركزية
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 font-mono">
                        FACTORY OS v2.1 • STATUS: <span className="text-green-500">OPERATIONAL</span> • UPTIME: 99.9%
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg flex items-center gap-3">
                        <Clock size={16} className="text-slate-500"/>
                        <span className="font-mono text-slate-200 text-sm">{new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    label="إنتاج اليوم" 
                    value={jobsToday.length} 
                    sub="فيديوهات مكتملة" 
                    icon={Video} 
                    color="text-blue-500"
                    trend="+12% vs Avg"
                />
                <KPICard 
                    label="قيد المعالجة" 
                    value={activeJobs.length} 
                    sub="عمليات نشطة" 
                    icon={Cpu} 
                    color="text-purple-500"
                />
                <KPICard 
                    label="استهلاك AI" 
                    value={`${(usage.totalTokens / 1000).toFixed(1)}k`} 
                    sub="Tokens Used" 
                    icon={Zap} 
                    color="text-amber-500"
                />
                <KPICard 
                    label="التكلفة التقديرية" 
                    value={`$${usage.estimatedCost.toFixed(3)}`} 
                    sub="Running Cost" 
                    icon={DollarSign} 
                    color="text-green-500"
                />
            </div>

            {/* MAIN DASHBOARD LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: PIPELINE & TERMINAL */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* LIVE PIPELINE MONITOR */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Layers className="text-blue-400" /> 
                                مراقب خط الإنتاج (Live Pipeline)
                            </h3>
                            {activeJobs.length > 0 && <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>}
                        </div>
                        
                        <div className="flex justify-between items-center px-4 relative">
                            <PipelineStage label="Strategy" count={pipelineCounts.Strategy} active={pipelineCounts.Strategy > 0} />
                            <PipelineStage label="Scripting" count={pipelineCounts.Scripting} active={pipelineCounts.Scripting > 0} />
                            <PipelineStage label="Visuals" count={pipelineCounts.Visuals} active={pipelineCounts.Visuals > 0} />
                            <PipelineStage label="Audio/Mix" count={pipelineCounts.Audio} active={pipelineCounts.Audio > 0} />
                            <PipelineStage label="Assembly" count={pipelineCounts.Assembly} active={pipelineCounts.Assembly > 0} />
                            <PipelineStage label="Publishing" count={pipelineCounts.Publishing} active={pipelineCounts.Publishing > 0} />
                        </div>

                        {activeJobs.length === 0 && (
                            <div className="mt-8 text-center text-slate-500 text-sm italic border-t border-slate-800/50 pt-4">
                                خط الإنتاج متوقف حالياً. ابدأ مهمة جديدة لتفعيل النظام.
                            </div>
                        )}
                    </div>

                    {/* LIVE TERMINAL */}
                    <div className="bg-black border border-slate-800 rounded-xl overflow-hidden flex flex-col h-96 font-mono shadow-2xl">
                        <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-green-500" />
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">System Kernel Log</span>
                            </div>
                            <div className="flex gap-1.5 opacity-50">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar text-xs">
                            {recentLogs.length === 0 && <div className="text-slate-600 opacity-50">Waiting for system events...</div>}
                            {recentLogs.map((log, idx) => (
                                <div key={idx} className="flex gap-3 text-slate-300 hover:bg-white/5 p-0.5 -mx-2 px-2 rounded transition">
                                    <span className="text-slate-600 shrink-0 select-none">
                                        {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                    </span>
                                    <span className={`font-bold shrink-0 w-24 truncate ${
                                        log.level === 'ERROR' ? 'text-red-500' : 
                                        log.level === 'WARN' ? 'text-amber-500' : 'text-blue-400'
                                    }`}>
                                        {log.agent}
                                    </span>
                                    <span className="opacity-80 flex-1 break-all">{log.message}</span>
                                    {log.jobTitle && <span className="text-slate-600 text-[10px] hidden sm:block truncate max-w-[100px] border border-slate-800 px-1 rounded">{log.jobTitle}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: AGENT MATRIX & ALERTS */}
                <div className="space-y-6">
                    
                    {/* AGENT MATRIX */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                            <BrainCircuit className="text-purple-400" /> 
                            مصفوفة الوكلاء (Agent Matrix)
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                AgentRole.STRATEGY_DIRECTOR, AgentRole.SCRIPT_BUILDER, 
                                AgentRole.VISUAL_PRODUCER, AgentRole.VOICE_DIRECTOR,
                                AgentRole.EDITOR_ASSEMBLER, AgentRole.PUBLISHER
                            ].map(role => {
                                const metric = agentMetrics.find(m => m.role === role);
                                const isWorking = activeJobs.some(j => j.steps[j.currentStepIndex]?.agentRole === role);
                                const hasError = metric?.status === 'DEGRADED' || metric?.status === 'SUSPENDED';
                                
                                return (
                                    <div key={role} className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                                        isWorking ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 
                                        hasError ? 'bg-red-900/10 border-red-500/30' :
                                        'bg-slate-950 border-slate-800 opacity-80 hover:opacity-100'
                                    }`}>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[90px]">
                                                {role.replace('Director','').replace('Builder','').replace('Producer','')}
                                            </div>
                                            <div className={`text-xs font-mono font-bold ${hasError ? 'text-red-400' : 'text-slate-200'}`}>
                                                {isWorking ? 'WORKING' : metric?.status || 'IDLE'}
                                            </div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${
                                            isWorking ? 'bg-blue-500 animate-pulse' : 
                                            hasError ? 'bg-red-500' : 
                                            'bg-slate-600'
                                        }`}></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ALERTS PANEL */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex-1">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                            <AlertOctagon size={18} className="text-red-400" />
                            تنبيهات النظام
                        </h3>
                        {failedJobs.length > 0 ? (
                            <div className="space-y-3">
                                {failedJobs.slice(0, 3).map(job => (
                                    <div key={job.id} className="p-3 bg-red-900/10 border border-red-900/40 rounded-lg text-red-300 text-xs">
                                        <div className="font-bold mb-1 flex items-center gap-2">
                                            <AlertTriangle size={12} /> Job Failed: {job.title.substring(0, 20)}...
                                        </div>
                                        <div className="opacity-80">Error: {job.error || "Unknown Error"}</div>
                                    </div>
                                ))}
                                {failedJobs.length > 3 && <div className="text-center text-xs text-red-400">+{failedJobs.length - 3} more errors</div>}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-slate-600 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                <CheckCircle2 size={32} className="mb-2 text-green-800" />
                                <p className="text-sm">All Systems Nominal</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Dashboard;
