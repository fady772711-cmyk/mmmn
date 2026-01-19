
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Production from './pages/Production';
import VideoLibrary from './pages/VideoLibrary';
import Automations from './pages/Automations'; 
import Analytics from './pages/Analytics'; 
import Settings from './pages/Settings'; 
import Providers from './pages/infrastructure/Providers';
import Voices from './pages/infrastructure/Voices';
import MusicLibrary from './pages/infrastructure/MusicLibrary'; 
import Agents from './pages/infrastructure/Agents';
import Publishing from './pages/infrastructure/Publishing';
import YouTubeConnect from './pages/infrastructure/YouTubeConnect';
import YouTubeCallback from './pages/infrastructure/YouTubeCallback';
import AdminAgent from './pages/AdminAgent'; 
import AdminArabic from './pages/AdminArabic';
import SystemAssistant from './components/SystemAssistant';
import { MOCK_RUNS } from './services/mockData';
import { db, TokenUsageStats } from './services/storageService';
import { Zap, DollarSign, Lock, X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { ToastEventDetail } from './services/notificationService';

// --- Toast Component ---
const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastEventDetail[]>([]);

    useEffect(() => {
        const handler = (e: CustomEvent<ToastEventDetail>) => {
            setToasts(prev => [...prev, e.detail]);
            // Auto dismiss
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== e.detail.id));
            }, 4000);
        };

        window.addEventListener('app-toast' as any, handler);
        return () => window.removeEventListener('app-toast' as any, handler);
    }, []);

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <div 
                    key={toast.id} 
                    className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-left-5 fade-in duration-300 backdrop-blur-md ${
                        toast.type === 'success' ? 'bg-slate-900/90 border-green-500/50 text-green-400' :
                        toast.type === 'error' ? 'bg-slate-900/90 border-red-500/50 text-red-400' :
                        toast.type === 'warning' ? 'bg-slate-900/90 border-amber-500/50 text-amber-400' :
                        'bg-slate-900/90 border-blue-500/50 text-blue-400'
                    }`}
                >
                    {toast.type === 'success' && <CheckCircle size={20} />}
                    {toast.type === 'error' && <AlertOctagon size={20} />}
                    {toast.type === 'warning' && <AlertTriangle size={20} />}
                    {toast.type === 'info' && <Info size={20} />}
                    
                    <p className="text-sm font-medium flex-1">{toast.message}</p>
                    
                    <button onClick={() => removeToast(toast.id)} className="text-slate-500 hover:text-white transition">
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [usageStats, setUsageStats] = useState<TokenUsageStats>({ promptTokens: 0, responseTokens: 0, totalTokens: 0, estimatedCost: 0 });
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Auth State
  const [isLocked, setIsLocked] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // 1. Initial Auth Check
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
      const settings = await db.getAuthSettings();
      if (settings.enabled) {
          setIsLocked(true);
      }
      setAuthChecking(false);
  };

  const handleLogin = async () => {
      const settings = await db.getAuthSettings();
      if (loginUser === settings.username && loginPass === settings.passwordHash) {
          setIsLocked(false);
      } else {
          alert("بيانات الدخول غير صحيحة");
      }
  };

  // 2. Initial Router Mock
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/integrations/youtube/callback')) {
       setActiveTab('youtube_callback');
    }
  }, []);

  // 3. Poll Usage
  useEffect(() => {
      const fetchUsage = async () => {
          const stats = await db.getGlobalUsage();
          setUsageStats(stats);
      };
      fetchUsage();
      const interval = setInterval(fetchUsage, 5000); 
      return () => clearInterval(interval);
  }, []);

  const handleEditJob = (jobId: string) => {
      setEditingJobId(jobId);
      setActiveTab('production');
  };

  const renderContent = () => {
    if (activeTab === 'youtube_callback') return <YouTubeCallback />;

    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'channels': return <Channels />;
      case 'production': return <Production initialJobId={editingJobId} />;
      case 'library': return <VideoLibrary onEditJob={handleEditJob} />;
      case 'automations': return <Automations />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
      case 'providers': return <Providers />;
      case 'voices': return <Voices />;
      case 'music': return <MusicLibrary />;
      case 'agents': return <Agents />;
      case 'publishing': return <Publishing />;
      case 'youtube_connect': return <YouTubeConnect />;
      case 'admin_agent': return <AdminAgent />;
      case 'admin_arabic': return <AdminArabic />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  if (authChecking) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-sans"><div className="animate-pulse">جاري التحميل...</div></div>;

  if (isLocked) {
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans bg-grid-pattern">
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
                  <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 ring-2 ring-blue-500/20">
                          <Lock size={32} />
                      </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white text-center mb-6">تسجيل الدخول للنظام</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-slate-400 text-sm mb-2">Username</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={loginUser}
                            onChange={e => setLoginUser(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-slate-400 text-sm mb-2">Password</label>
                          <input 
                            type="password" 
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={loginPass}
                            onChange={e => setLoginPass(e.target.value)}
                          />
                      </div>
                      <button 
                        onClick={handleLogin}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition shadow-lg shadow-blue-900/20"
                      >
                          دخول
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen text-slate-200 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Content Area - Transparent to show global background */}
      <main className="flex-1 mr-64 p-8 transition-all duration-300 relative z-0">
        <header className="flex justify-between items-center mb-8 bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-white/5 shadow-sm sticky top-4 z-40">
            <div className="flex items-center text-slate-500 text-sm font-medium">
                <span className="text-slate-400">AutoVideo OS</span>
                <span className="mx-2 text-slate-700">/</span>
                <span className="capitalize text-slate-200">{activeTab.replace('_', ' ')}</span>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Cost / Token Display */}
                <div className="flex items-center gap-4 bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-1.5 hover:border-slate-700 transition" title="Cost based on Gemini 1.5 Flash Pricing">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" />
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-xs font-bold text-slate-200">{(usageStats.totalTokens / 1000).toFixed(1)}k</span>
                            <span className="text-[10px] text-slate-500">TOKENS</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-slate-800"></div>
                    <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-green-500" />
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-xs font-bold text-green-400">${usageStats.estimatedCost.toFixed(4)}</span>
                            <span className="text-[10px] text-slate-500">COST</span>
                        </div>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-green-500">System Online</span>
                </div>
            </div>
        </header>
        
        <div className="relative z-0">
            {renderContent()}
        </div>
      </main>

      {/* Overlays */}
      <SystemAssistant />
      <ToastContainer />
    </div>
  );
};

export default App;
