
import React, { useState, useEffect } from 'react';
import { 
    Activity, CheckCircle2, AlertTriangle, 
    Layers, Terminal, TrendingUp, DollarSign, Zap, 
    Video, Cpu, BrainCircuit, Clock, Loader2, Play, Pause, AlertOctagon, Server, HardDrive, Network
} from 'lucide-react';
import { ProductionJob, JobStatus, AgentRole } from '../types';
import { db } from '../services/storageService';

interface DashboardProps {
    setActiveTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
    // --- State ---
    const [jobs, setJobs] = useState<ProductionJob[]>([]);
    const [agentMetrics, setAgentMetrics] = useState<any[]>([]);
    const [usage, setUsage] = useState<any>({ totalTokens: 0, estimatedCost: 0 });
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [serverStats, setServerStats] = useState({ cpu: 0, ram: 0, uptime: 0, latency: 0, totalMemGb: '0' });
    const [loading, setLoading] = useState(true);

    // --- Effect: Load Data Live ---
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 3000); // Live refresh every 3s
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            // Fetch Server Stats & Latency
            const startPing = Date.now();
            let serverHealth: any = { system: { cpu: 0, ram: 0, totalMemGb: 0 }, uptime: 0 };
            try {
                const res = await fetch('/api/health');
                if (res.ok) serverHealth = await res.json();
            } catch(e) { console.error("Server ping failed"); }
            const latency = Date.now() - startPing;

            setServerStats({
                cpu: serverHealth.system?.cpu || 0,
                ram: serverHealth.system?.ram || 0,
                totalMemGb: serverHealth.system?.totalMemGb || '8',
                uptime: serverHealth.uptime || 0,
                latency
            });

            // Fetch Data
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
    const activeJobs = jobs.filter(j => j.status === JobStatus.RUNNING || j.status === JobStatus.NEEDS_APPROVAL);
    const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);
    const failedJobs = jobs.filter(j => j.status === JobStatus.FAILED);
    
    const today = new Date().toISOString().split('T')[0];
    const jobsToday = completedJobs.filter(j => j.createdAt.startsWith(today));
    
    // Format Uptime
    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // --- Components ---

    const KPICard = ({ label, value, sub, icon: Icon, color, trend, gradient, onClick }: any) => (
        <div 
            onClick={onClick}
            role="button"
            className={`relative overflow-hidden p-6 rounded-2xl group cursor-pointer hover:-translate-y-1 transition-all duration-300 border border-white/5 shadow-xl ${gradient}`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon size={100} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm text-white">
                        <Icon size={20} />
                    </div>
                    <span className="text-white/70 text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-4xl font-bold text-white font-mono mb-2 drop-shadow-md">{value}</div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">{sub}</span>
                    {trend && <span className="text-xs text-white bg-white/20 px-2 py-0.5 rounded-full font-medium">{trend}</span>}
                </div>
            </div>
        </div>
    );

    const PipelineStage = ({ label, count, active }: { label: string, count: number, active: boolean }) => (
        <div className={`flex-1 flex flex-col items-center gap-2 relative group`}>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</div>
            <div className={`w-full h-2 rounded-full overflow-hidden bg-slate-800 relative`}>
                <div className={`h-full transition-all duration-500 ${active ? 'bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]' : 'bg-slate-700'}`} style={{ width: active ? '100%' : '0%' }}></div>
            </div>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold z-10 transition-all ${active ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.8)] scale-110' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                {count}
            </div>
            <div className="absolute top-7 left-1/2 w-full h-[2px] bg-slate-800 -z-0"></div>
        </div>
    );

    const pipelineCounts = {
        Strategy: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Strategy') || j.steps[j.currentStepIndex]?.agentRole.includes('Title')).length,
        Scripting: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Script')).length,
        Visuals: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Visual') || j.steps[j.currentStepIndex]?.agentRole.includes('Scene')).length,
        Audio: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Voice') || j.steps[j.currentStepIndex]?.agentRole.includes('Music')).length,
        Assembly: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Editor')).length,
        Publishing: activeJobs.filter(j => j.steps[j.currentStepIndex]?.agentRole.includes('Publisher')).length,
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            
            {/* HEADER */}
            <div className="flex justify-between items-end pb-2">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-blue-500" />
                        غرفة العمليات المركزية
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 font-mono">
                        FACTORY OS v2.1 • STATUS: <span className="text-green-500 font-bold glow-text">OPERATIONAL</span> • UPTIME: 99.9%
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg">
                        <Clock size={16} className="text-slate-500"/>
                        <span className="font-mono text-slate-200 text-sm">{new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="إنتاج اليوم" value={jobsToday.length} sub="فيديوهات مكتملة" icon={Video} gradient="bg-gradient-to-br from-blue-600/90 to-blue-900/90" trend="+12% vs Avg" onClick={() => setActiveTab('library')} />
                <KPICard label="قيد المعالجة" value={activeJobs.length} sub="عمليات نشطة" icon={Cpu} gradient="bg-gradient-to-br from-purple-600/90 to-purple-900/90" onClick={() => setActiveTab('production')} />
                <KPICard label="استهلاك AI" value={`${(usage.totalTokens / 1000).toFixed(1)}k`} sub="Tokens Used" icon={Zap} gradient="bg-gradient-to-br from-amber-500/90 to-amber-800/90" onClick={() => setActiveTab('settings')} />
                <KPICard label="التكلفة التقديرية" value={`$${usage.estimatedCost.toFixed(3)}`} sub="Running Cost" icon={DollarSign} gradient="bg-gradient-to-br from-green-600/90 to-green-900/90" onClick={() => setActiveTab('settings')} />
            </div>

            {/* MAIN DASHBOARD LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: PIPELINE & TERMINAL */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* LIVE PIPELINE MONITOR */}
                    <div onClick={() => setActiveTab('production')} role="button" className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:border-blue-500/50 transition-all select-none shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-bold text-white flex items-center gap-2 group-hover:text-blue-400 transition-colors text-lg">
                                <Layers className="text-blue-400" /> 
                                مراقب خط الإنتاج (Live Pipeline)
                            </h3>
                            {activeJobs.length > 0 && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                        </div>
                        <div className="flex justify-between items-center px-4 relative">
                            <PipelineStage label="Strategy" count={pipelineCounts.Strategy} active={pipelineCounts.Strategy > 0} />
                            <PipelineStage label="Scripting" count={pipelineCounts.Scripting} active={pipelineCounts.Scripting > 0} />
                            <PipelineStage label="Visuals" count={pipelineCounts.Visuals} active={pipelineCounts.Visuals > 0} />
                            <PipelineStage label="Audio/Mix" count={pipelineCounts.Audio} active={pipelineCounts.Audio > 0} />
                            <PipelineStage label="Assembly" count={pipelineCounts.Assembly} active={pipelineCounts.Assembly > 0} />
                            <PipelineStage label="Publishing" count={pipelineCounts.Publishing} active={pipelineCounts.Publishing > 0} />
                        </div>
                        {activeJobs.length === 0 && <div className="mt-8 text-center text-slate-500 text-sm italic border-t border-slate-800/50 pt-4">خط الإنتاج متوقف حالياً. اضغط هنا لبدء مهمة جديدة.</div>}
                    </div>

                    {/* LIVE TERMINAL */}
                    <div className="bg-black/80 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-96 font-mono shadow-2xl backdrop-blur-md">
                        <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-green-500" />
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">System Kernel Log</span>
                            </div>
                            <div className="flex gap-1.5 opacity-50"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar text-xs">
                            {recentLogs.length === 0 && <div className="text-slate-600 opacity-50">Waiting for system events...</div>}
                            {recentLogs.map((log, idx) => (
                                <div key={idx} className="flex gap-3 text-slate-300 hover:bg-white/5 p-0.5 -mx-2 px-2 rounded transition border-l-2 border-transparent hover:border-slate-700 pl-2">
                                    <span className="text-slate-600 shrink-0 select-none">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                    <span className={`font-bold shrink-0 w-24 truncate ${log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-blue-400'}`}>{log.agent}</span>
                                    <span className="opacity-80 flex-1 break-all">{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: SYSTEM HEALTH & AGENTS */}
                <div className="space-y-6">
                    
                    {/* SERVER RESOURCES MONITOR (NEW) */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                            <Server className="text-green-400" />
                            حالة السيرفر (Infrastructure)
                        </h3>
                        
                        <div className="space-y-4">
                            {/* CPU */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-400 flex items-center gap-1"><Cpu size={12}/> CPU Load</span>
                                    <span className={`font-bold font-mono ${serverStats.cpu > 80 ? 'text-red-400' : 'text-green-400'}`}>{serverStats.cpu}%</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ${serverStats.cpu > 80 ? 'bg-red-500' : serverStats.cpu > 50 ? 'bg-amber-500' : 'bg-green-500'}`} 
                                        style={{ width: `${serverStats.cpu}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* RAM */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-400 flex items-center gap-1"><HardDrive size={12}/> RAM Usage</span>
                                    <span className="font-bold font-mono text-blue-400">{serverStats.ram}% <span className="text-[10px] text-slate-600">/ {serverStats.totalMemGb}GB</span></span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 bg-blue-500" 
                                        style={{ width: `${serverStats.ram}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Network / Stats Row */}
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                                    <div className="text-[10px] text-slate-500 mb-1 flex justify-center items-center gap-1"><Network size={10}/> Latency</div>
                                    <div className={`font-mono text-sm font-bold ${serverStats.latency > 500 ? 'text-red-400' : 'text-slate-200'}`}>{serverStats.latency}ms</div>
                                </div>
                                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                                    <div className="text-[10px] text-slate-500 mb-1 flex justify-center items-center gap-1"><Clock size={10}/> Uptime</div>
                                    <div className="font-mono text-sm font-bold text-slate-200">{formatUptime(serverStats.uptime)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AGENT MATRIX */}
                    <div onClick={() => setActiveTab('agents')} role="button" className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-purple-500/50 transition-all group select-none shadow-xl">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4 group-hover:text-purple-400 transition-colors">
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
                                    <div key={role} className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isWorking ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : hasError ? 'bg-red-900/10 border-red-500/30' : 'bg-slate-950 border-slate-800 opacity-80 hover:opacity-100'}`}>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[90px]">{role.replace('Director','').replace('Builder','').replace('Producer','')}</div>
                                            <div className={`text-xs font-mono font-bold ${hasError ? 'text-red-400' : 'text-slate-200'}`}>{isWorking ? 'WORKING' : metric?.status || 'IDLE'}</div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${isWorking ? 'bg-blue-500 animate-pulse' : hasError ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ALERTS PANEL */}
                    <div onClick={() => setActiveTab('automations')} role="button" className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 flex-1 cursor-pointer hover:border-red-500/30 transition-all group select-none shadow-xl">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4 group-hover:text-red-400 transition-colors"><AlertOctagon size={18} className="text-red-400" /> تنبيهات النظام</h3>
                        {failedJobs.length > 0 ? (
                            <div className="space-y-3">
                                {failedJobs.slice(0, 3).map(job => (
                                    <div key={job.id} className="p-3 bg-red-900/10 border border-red-900/40 rounded-lg text-red-300 text-xs">
                                        <div className="font-bold mb-1 flex items-center gap-2"><AlertTriangle size={12} /> Job Failed: {job.title.substring(0, 20)}...</div>
                                        <div className="opacity-80">Error: {job.error || "Unknown Error"}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-24 text-slate-600 bg-slate-950/30 rounded-xl border border-slate-800/50 border-dashed">
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
