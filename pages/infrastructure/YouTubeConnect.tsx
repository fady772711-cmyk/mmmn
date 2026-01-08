import React, { useState, useEffect } from 'react';
import { db } from '../../services/storageService';
import { generateAuthUrl, FEATURE_YOUTUBE_CONNECT } from '../../services/youtubeAuthService';
import { Youtube, Save, ExternalLink, ShieldAlert, Loader2 } from 'lucide-react';

const YouTubeConnect: React.FC = () => {
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    loadConfig();
    setRedirectUrl(window.location.origin + '/integrations/youtube/callback');
  }, []);

  const loadConfig = async () => {
    const config = await db.getYouTubeConfig();
    if (config) setClientId(config.clientId);
  };

  const handleSave = async () => {
    await db.saveYouTubeConfig({
      clientId,
      redirectUri: redirectUrl
    });
    alert("تم حفظ الإعدادات بنجاح");
  };

  const handleConnect = async () => {
    if (!clientId) return alert("الرجاء إدخال Client ID أولاً");
    setLoading(true);
    try {
      const authUrl = await generateAuthUrl();
      window.location.href = authUrl; // Redirect to Google
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  };

  if (!FEATURE_YOUTUBE_CONNECT) return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">إعدادات ربط يوتيوب (Integrations)</h2>
          <p className="text-slate-400">إدارة صلاحيات الوصول وربط القنوات بالنظام</p>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white">
                <Youtube size={24} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-slate-200">YouTube OAuth 2.0 Configuration</h3>
                <p className="text-xs text-slate-500">مطلوب لتمكين النظام من قراءة بيانات القناة</p>
            </div>
        </div>

        <div className="space-y-4 max-w-2xl">
            <div className="p-4 bg-slate-950 rounded border border-slate-800 text-sm space-y-2">
                <p className="font-bold text-slate-400">خطوات الإعداد في Google Cloud Console:</p>
                <ol className="list-decimal list-inside text-slate-500 space-y-1">
                    <li>Create Project & Enable YouTube Data API v3</li>
                    <li>Create OAuth 2.0 Client ID (Web Application)</li>
                    <li>Add Authorized Redirect URI: <code className="bg-slate-800 px-1 rounded select-all text-blue-400">{redirectUrl}</code></li>
                    <li>انسخ Client ID وضعه في الحقل أدناه</li>
                </ol>
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">Google Client ID</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="xxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 font-mono text-sm focus:border-red-500 outline-none transition"
                    />
                    <button 
                        onClick={handleSave}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 rounded-lg flex items-center gap-2 transition"
                    >
                        <Save size={18} />
                        <span>حفظ</span>
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Action Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex justify-between items-center">
        <div>
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                ربط قناة جديدة
            </h3>
            <p className="text-sm text-slate-500 mt-1">سيتم توجيهك إلى Google لاختيار الحساب ومنح الصلاحيات.</p>
        </div>
        
        <button 
            onClick={handleConnect}
            disabled={loading || !clientId}
            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? <Loader2 className="animate-spin" size={20}/> : <ExternalLink size={20} />}
            <span>بدء الربط (Connect)</span>
        </button>
      </div>

      <div className="flex items-start gap-2 text-amber-500 bg-amber-900/10 p-4 rounded-lg border border-amber-900/30 text-sm">
        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
        <p>ملاحظة أمنية: هذا النظام يعمل بنظام Client-Side Demo. الرموز (Tokens) ستخزن في LocalStorage للمتصفح. في الإنتاج الحقيقي، يجب تخزين Refresh Tokens مشفرة في قاعدة بيانات الخادم (Backend).</p>
      </div>
    </div>
  );
};

export default YouTubeConnect;
