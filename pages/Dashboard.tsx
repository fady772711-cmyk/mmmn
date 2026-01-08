import React from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { ProductionRun, JobStatus } from '../types';

interface DashboardProps {
  runs: ProductionRun[];
}

const StatCard: React.FC<{ label: string; value: string | number; icon: any; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-slate-100">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ runs }) => {
  const activeRuns = runs.filter(r => r.status === JobStatus.RUNNING).length;
  const failedRuns = runs.filter(r => r.status === JobStatus.FAILED).length;
  const completedToday = 12; // Mock

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">نظرة عامة</h2>
        <p className="text-slate-400">ملخص نشاط المصنع وحالة الوكلاء</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عمليات جارية" value={activeRuns} icon={Activity} color="bg-blue-500" />
        <StatCard label="مكتمل اليوم" value={completedToday} icon={CheckCircle2} color="bg-green-500" />
        <StatCard label="تحتاج مراجعة" value="3" icon={Clock} color="bg-amber-500" />
        <StatCard label="أخطاء النظام" value={failedRuns} icon={AlertCircle} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">نشاط الوكلاء المباشر</h3>
          <div className="space-y-4">
            {[
              { agent: 'StrategyDirector', action: 'تحليل الترند لـ قناة التاريخ', time: 'منذ دقيقتين', status: 'success' },
              { agent: 'ScriptBuilder', action: 'كتابة المشهد 4: سقوط روما', time: 'الآن', status: 'running' },
              { agent: 'VisualProducer', action: 'توليد 15 صورة (Midjourney)', time: 'الآن', status: 'running' },
              { agent: 'Publisher', action: 'فشل رفع الفيديو #402', time: 'منذ 15 دقيقة', status: 'error' },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    log.status === 'success' ? 'bg-green-500' :
                    log.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{log.agent}</p>
                    <p className="text-xs text-slate-500">{log.action}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-600 font-mono">{log.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">حالة النظام</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">YouTube API Limit</span>
              <span className="text-green-400">12% Used</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '12%' }}></div>
            </div>

            <div className="flex justify-between items-center text-sm mt-4">
              <span className="text-slate-400">Gemini Tokens</span>
              <span className="text-blue-400">45% Used</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
            </div>

             <div className="flex justify-between items-center text-sm mt-4">
              <span className="text-slate-400">Storage (Artifacts)</span>
              <span className="text-amber-400">78% Used</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;