
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
import AdminArabic from './pages/AdminArabic'; // New Import
import SystemAssistant from './components/SystemAssistant';
import { MOCK_RUNS } from './services/mockData';
import { db, TokenUsageStats } from './services/storageService';
import { Zap, DollarSign, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [usageStats, setUsageStats] = useState<TokenUsageStats>({ promptTokens: 0, responseTokens: 0, totalTokens: 0, estimatedCost: 0 });
  
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

  const renderContent = () => {
    if (activeTab === 'youtube_callback') return <YouTubeCallback />;

    switch (activeTab) {
      case 'dashboard': return <Dashboard runs={MOCK_RUNS} />;
      case 'channels': return <Channels />;
      case 'production': return <Production />;
      case 'library': return <VideoLibrary />;
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
      case 'admin_arabic': return <AdminArabic />; // New Route
      default: return <Dashboard runs={MOCK_RUNS} />;
    }
  };

  if (authChecking) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">جاري التحميل...</div>;

  if (isLocked) {
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
                  <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500">
                          <Lock size={32} />
                      </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white text-center mb-6">تسجيل الدخول للنظام</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-slate-400 text-sm mb-2">Username</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white"
                            value={loginUser}
                            onChange={e => setLoginUser(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-slate-400 text-sm mb-2">Password</label>
                          <input 
                            type="password" 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white"
                            value={loginPass}
                            onChange={e => setLoginPass(e.target.value)}
                          />
                      </div>
                      <button 
                        onClick={handleLogin}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition"
                      >
                          دخول
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 mr-64 p-8 transition-all duration-300">
        <header className="flex justify-between items-center mb-8">
            <div className="flex items-center text-slate-500 text-sm">
                <span>AutoVideo OS</span>
                <span className="mx-2">/</span>
                <span className="capitalize text-slate-200">{activeTab.replace('_', ' ')}</span>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Cost / Token Display */}
                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5" title="Cost based on Gemini 1.5 Flash Pricing">
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
                            <span className="text-[10px] text-slate-500">COST ($0.30/1M)</span>
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
        
        {renderContent()}
      </main>

      {/* Floating AI Assistant */}
      <SystemAssistant />
    </div>
  );
};

export default App;
