import React, { useEffect, useState } from 'react';
import { handleAuthCallback, fetchUserChannels, linkChannelToApp } from '../../services/youtubeAuthService';
import { db } from '../../services/storageService';
import { Channel, YouTubeChannelDetails } from '../../types';
import { Loader2, CheckCircle2, AlertTriangle, Link, ArrowRight, XCircle } from 'lucide-react';

const YouTubeCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'selecting' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');
  const [ytChannels, setYtChannels] = useState<YouTubeChannelDetails[]>([]);
  const [appChannels, setAppChannels] = useState<Channel[]>([]);
  
  // Selection
  const [selectedYt, setSelectedYt] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  useEffect(() => {
    processCallback();
  }, []);

  const processCallback = async () => {
    try {
      // 1. Exchange Token
      const hash = window.location.hash;
      if (!hash) throw new Error("No token returned from Google.");
      
      const { accessToken } = await handleAuthCallback(hash);
      
      // 2. Fetch User Channels
      const channels = await fetchUserChannels(accessToken);
      if (channels.length === 0) throw new Error("No YouTube channels found for this account.");
      
      setYtChannels(channels);
      
      // 3. Load App Channels for mapping
      const localChannels = await db.getChannels();
      setAppChannels(localChannels);

      setStatus('selecting');
      
      // Clear hash to be clean
      window.history.replaceState(null, '', window.location.pathname);

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || "Unknown Auth Error");
    }
  };

  const handleLink = async () => {
    if (!selectedYt || !selectedApp) return;
    
    try {
        const ytChannel = ytChannels.find(c => c.id === selectedYt);
        if (!ytChannel) return;

        await linkChannelToApp(selectedApp, ytChannel);
        setStatus('success');
    } catch (e: any) {
        setStatus('error');
        setErrorMsg(e.message);
    }
  };

  // --- RENDER STATES ---

  if (status === 'processing') {
      return (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <h2 className="text-xl font-bold text-white">جاري الاتصال بـ Google...</h2>
              <p className="text-slate-400">يرجى الانتظار، يتم جلب بيانات القناة.</p>
          </div>
      );
  }

  if (status === 'error') {
      return (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                  <XCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">فشل الربط</h2>
              <p className="text-red-400 bg-red-950/30 px-4 py-2 rounded border border-red-900/50">{errorMsg}</p>
              <button onClick={() => window.location.href='/integrations/youtube'} className="text-slate-400 hover:text-white underline">العودة للإعدادات</button>
          </div>
      );
  }

  if (status === 'success') {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle2 size={40} />
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">تم الربط بنجاح!</h2>
                <p className="text-slate-400">أصبحت القناة جاهزة الآن للاستخدام في النظام.</p>
            </div>
            <a href="/channels" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium">
                الذهاب للقنوات
            </a>
        </div>
      );
  }

  // Selecting State
  return (
    <div className="max-w-4xl mx-auto py-10">
      <h2 className="text-2xl font-bold text-white mb-6">إكمال الربط (Finalize Link)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        
        {/* Step 1: YouTube Channel */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase">1. قناة يوتيوب المكتشفة</h3>
            <div className="space-y-3">
                {ytChannels.map(ch => (
                    <div 
                        key={ch.id} 
                        onClick={() => setSelectedYt(ch.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${selectedYt === ch.id ? 'bg-red-900/20 border-red-500 ring-1 ring-red-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                    >
                        <img src={ch.thumbnail} alt={ch.title} className="w-10 h-10 rounded-full bg-slate-800" />
                        <div className="overflow-hidden">
                            <p className="font-bold text-slate-200 truncate">{ch.title}</p>
                            <p className="text-xs text-slate-500 truncate">{ch.customUrl || ch.id}</p>
                        </div>
                        {selectedYt === ch.id && <CheckCircle2 size={18} className="text-red-500 ml-auto shrink-0" />}
                    </div>
                ))}
            </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center text-slate-600">
            <ArrowRight size={32} className="hidden md:block" />
            <div className="md:hidden rotate-90 my-4"><ArrowRight size={32} /></div>
        </div>

        {/* Step 2: System Channel */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase">2. اختر قناة النظام للربط</h3>
            <div className="space-y-3 h-80 overflow-y-auto pr-2 custom-scrollbar">
                {appChannels.map(ch => (
                    <div 
                        key={ch.id} 
                        onClick={() => setSelectedApp(ch.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition ${selectedApp === ch.id ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                    >
                        <p className="font-bold text-slate-200">{ch.name}</p>
                        <div className="flex justify-between items-center mt-1">
                             <span className="text-xs text-slate-500">{ch.language}</span>
                             {ch.linkedYouTubeChannel && <span className="text-[10px] bg-green-900/30 text-green-500 px-1 rounded">Linked</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="mt-10 border-t border-slate-800 pt-6 flex justify-end">
          <button 
            onClick={handleLink}
            disabled={!selectedYt || !selectedApp}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              <Link size={20} />
              <span>تأكيد الربط</span>
          </button>
      </div>
    </div>
  );
};

export default YouTubeCallback;
