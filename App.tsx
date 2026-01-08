import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Production from './pages/Production';
import VideoLibrary from './pages/VideoLibrary';
import Providers from './pages/infrastructure/Providers';
import Voices from './pages/infrastructure/Voices';
import Agents from './pages/infrastructure/Agents';
import Publishing from './pages/infrastructure/Publishing';
import YouTubeConnect from './pages/infrastructure/YouTubeConnect';
import YouTubeCallback from './pages/infrastructure/YouTubeCallback';
import { MOCK_RUNS } from './services/mockData';
import { db, TokenUsageStats } from './services/storageService';
import { Zap, DollarSign } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [usageStats, setUsageStats] = useState<TokenUsageStats>({ promptTokens: 0, responseTokens: 0, totalTokens: 0, estimatedCost: 0 });

  // Basic Router Mock for this demo structure
  useEffect(() => {
    const path = window.location.pathname;
    
    // Check for OAuth Callback
    if (path.includes('/integrations/youtube/callback')) {
       setActiveTab('youtube_callback');
    }
  }, []);

  // Poll usage stats
  useEffect(() => {
      const fetchUsage = async () => {
          const stats = await db.getGlobalUsage();
          setUsageStats(stats);
      };
      
      fetchUsage();
      const interval = setInterval(fetchUsage, 5000); // Update every 5s
      return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    // Override for callback route
    if (activeTab === 'youtube_callback') return <YouTubeCallback />;

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard runs={MOCK_RUNS} />;
      case 'channels':
        return <Channels />;
      case 'production':
        return <Production />;
      case 'library':
        return <VideoLibrary />; // New Page
      case 'providers':
        return <Providers />;
      case 'voices':
        return <Voices />;
      case 'agents':
        return <Agents />;
      case 'publishing':
        return <Publishing />;
      case 'youtube_connect':
        return <YouTubeConnect />;
      case 'automations':
        return (
            <div className="flex items-center justify-center h-96 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p>وحدة إدارة الأتمتة (قيد التطوير في هذه النسخة التجريبية)</p>
            </div>
        );
      case 'analytics':
          return (
            <div className="flex items-center justify-center h-96 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p>وحدة التحليلات (YouTube API Integration Required)</p>
            </div>
        );
      default:
        return <Dashboard runs={MOCK_RUNS} />;
    }
  };

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
    </div>
  );
};

export default App;