
import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, Server, Cpu, HardDrive, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { ProductionRun, JobStatus, AgentMetrics } from '../types';
import { db } from '../services/storageService';

interface DashboardProps {
  runs: ProductionRun[];
}

const Dashboard: React.FC<DashboardProps> = ({ runs }) => {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [activeJobs, setActiveJobs] = useState<number>(0);
  const [failedJobs, setFailedJobs] = useState<number>(0);
  const [completedToday, setCompletedToday] = useState<number>(0);
  const [systemHealth, setSystemHealth] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
      const loadData = async () => {
          // 1. Load Metrics
          const m = await db.getAgentMetrics();
          setMetrics(m);

          // 2. Load Jobs Stats
          const jobs = await db.getJobs();
          const running = jobs.filter(j => j.status === JobStatus.RUNNING).length;
          const failed = jobs.filter(j => j.status === JobStatus.FAILED).length;
          const completed = jobs.filter(j => j.status === JobStatus.COMPLETED && new Date(j.runId) > new Date(Date.now() - 86400000)).length;
          
          setActiveJobs(running);
          setFailedJobs(failed);
          setCompletedToday(completed);

          // 3. Calculate Health & Alerts
          const suspendedAgents = m.filter(agent => agent.status === 'SUSPENDED');
          const degradedAgents = m.filter(agent => agent.status === 'DEGRADED');
          
          const newAlerts: string[] = [];
          if (suspendedAgents.length > 0) {
              setSystemHealth('RED');
              suspendedAgents.forEach(a => newAlerts.push(`CRITICAL: Agent ${a.role} Suspended (Failure > 20%)`));
          } else if (degradedAgents.length > 0 || failed > 5) {
              setSystemHealth('YELLOW');
              degradedAgents.forEach(a => newAlerts.push(`WARNING: Agent ${a.role} Degraded`));
              if (failed > 5) newAlerts.push(`High Job Failure Count: ${failed}`);
          } else {
              setSystemHealth('GREEN');
          }
          setAlerts(newAlerts);
      };

      loadData();
      const interval = setInterval(loadData, 5000); // Poll every 5s
      return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">لوحة المراقبة (System Monitor)</h2>
          <p className="text-slate-400">KPIs وقياس أداء الوكلاء</p>
        </div>
        
        {/* SECTION A: SYSTEM HEALTH */}
        <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 font-bold ${
            systemHealth === 'GREEN' ? 'bg-green-900/20 border-green-500 text-green-500' :
            systemHealth === 'YELLOW' ? 'bg-amber-900/20 border-amber-500 text-amber-500' :
            'bg-red-900/20 border-red-500 text-red-500 animate-pulse'
        }`}>
            <Activity size={20} />
            SYSTEM HEALTH: {systemHealth}
        </div>
      </div>

      {/* SECTION C: PRODUCTION TODAY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <p className="text-slate-500 text-sm mb-1">عمليات جارية</p>
            <h3 className="text-3xl font-bold text-blue-400">{activeJobs}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <p className="text-slate-500 text-sm mb-1">مكتمل اليوم</p>
            <h3 className="text-3xl font-bold text-green-400">{completedToday}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <p className="text-slate-500 text-sm mb-1">فشل (Failed)</p>
            <h3 className={`text-3xl font-bold ${failedJobs > 0 ? 'text-red-500' : 'text-slate-400'}`}>{failedJobs}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <p className="text-slate-500 text-sm mb-1">Alerts</p>
            <h3 className="text-3xl font-bold text-amber-500">{alerts.length}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION B: AGENTS TABLE */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">أداء الوكلاء (Agents KPI)</h3>
              <span className="text-xs text-slate-500">Live Data</span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                  <thead className="bg-slate-950 text-slate-400">
                      <tr>
                          <th className="p-4">Agent Name</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Avg Time</th>
                          <th className="p-4">Failure %</th>
                          <th className="p-4">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {metrics.length === 0 ? (
                          <tr><td colSpan={5} className="p-8 text-center text-slate-500">جاري جمع البيانات...</td></tr>
                      ) : metrics.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50">
                              <td className="p-4 font-bold text-slate-200">{m.role.replace('Agent', '')}</td>
                              <td className="p-4 text-xs font-mono text-slate-500">{m.role}</td>
                              <td className="p-4 font-mono">{(m.avgExecutionTime / 1000).toFixed(2)}s</td>
                              <td className={`p-4 font-bold ${m.failureRate > 10 ? 'text-red-500' : 'text-green-500'}`}>
                                  {m.failureRate}%
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs border ${
                                      m.status === 'ACTIVE' ? 'bg-green-900/20 border-green-500 text-green-500' :
                                      m.status === 'SUSPENDED' ? 'bg-red-900/20 border-red-500 text-red-500' :
                                      'bg-amber-900/20 border-amber-500 text-amber-500'
                                  }`}>
                                      {m.status}
                                  </span>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </div>

        {/* SECTION D: ALERTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" />
                Active Alerts
            </h3>
            {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                    <ShieldCheck size={40} className="mb-2 text-green-800" />
                    <p>All Systems Nominal</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert, i) => (
                        <div key={i} className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-300 text-sm flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            {alert}
                        </div>
                    ))}
                </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-bold text-slate-400 mb-2">Automated Rules</h4>
                <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                    <li>Suspend if Failure &gt; 20%</li>
                    <li>Flag if Avg Time &gt; 2x Baseline</li>
                    <li>Force Task if Idle &gt; 30%</li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
