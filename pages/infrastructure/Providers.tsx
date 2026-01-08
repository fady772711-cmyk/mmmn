import React, { useEffect, useState } from 'react';
import { ProviderConfig, ProviderType } from '../../types';
import { db } from '../../services/storageService';
import { CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Save } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const Providers: React.FC = () => {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.getProviders();
    setProviders(data);
    setLoading(false);
  };

  const handleUpdate = (id: string, updates: Partial<ProviderConfig>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const saveProvider = async (provider: ProviderConfig) => {
    await db.saveProvider(provider);
    // Show toast or feedback
  };

  const testConnection = async (provider: ProviderConfig) => {
    setTestingId(provider.id);
    let status: 'operational' | 'error' = 'error';

    try {
      if (provider.providerId === 'gemini') {
         if (!provider.apiKey) throw new Error("Missing Key");
         const ai = new GoogleGenAI({ apiKey: provider.apiKey });
         // Simple test using a valid model
         await ai.models.generateContent({
             model: 'gemini-2.0-flash', 
             contents: 'Test connection'
         });
         status = 'operational';
      } else {
        // Mock test for others
        await new Promise(r => setTimeout(r, 1000));
        status = 'operational';
      }
    } catch (e) {
      console.error(e);
      status = 'error';
    }

    const updated = { ...provider, status, lastTestedAt: new Date().toISOString() };
    handleUpdate(provider.id, updated);
    await db.saveProvider(updated);
    setTestingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">إدارة المزودات (Providers)</h2>
          <p className="text-slate-400">ربط مفاتيح API للذكاء الاصطناعي والخدمات الخارجية</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
            <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : (
            <table className="w-full text-right">
            <thead className="bg-slate-950 text-slate-400 text-sm">
                <tr>
                <th className="p-4 font-medium">الخدمة</th>
                <th className="p-4 font-medium">النوع</th>
                <th className="p-4 font-medium">API Key</th>
                <th className="p-4 font-medium">الحالة</th>
                <th className="p-4 font-medium">تحكم</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {providers.map(provider => (
                <tr key={provider.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4">
                        <div className="font-bold text-slate-200">{provider.name}</div>
                        <div className="text-xs text-slate-500">{provider.providerId}</div>
                    </td>
                    <td className="p-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400 border border-slate-700">
                            {provider.type}
                        </span>
                    </td>
                    <td className="p-4">
                        <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-3 py-2 max-w-xs">
                            <input 
                                type={showKey[provider.id] ? "text" : "password"}
                                value={provider.apiKey || ''}
                                onChange={(e) => handleUpdate(provider.id, { apiKey: e.target.value })}
                                placeholder="sk-..."
                                className="bg-transparent border-none outline-none text-sm text-slate-300 w-full font-mono"
                            />
                            <button onClick={() => setShowKey(prev => ({...prev, [provider.id]: !prev[provider.id]}))} className="text-slate-500 hover:text-slate-300 ml-2">
                                {showKey[provider.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
                        </div>
                    </td>
                    <td className="p-4">
                        <div className="flex items-center gap-2">
                            {provider.status === 'operational' && <CheckCircle2 size={16} className="text-green-500" />}
                            {provider.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                            {provider.status === 'untested' && <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                            <span className={`text-sm ${
                                provider.status === 'operational' ? 'text-green-500' : 
                                provider.status === 'error' ? 'text-red-500' : 'text-slate-500'
                            }`}>
                                {provider.status === 'operational' ? 'متصل' : provider.status === 'error' ? 'خطأ' : 'غير مختبر'}
                            </span>
                        </div>
                        {provider.lastTestedAt && <div className="text-[10px] text-slate-600 mt-1">Checked: {new Date(provider.lastTestedAt).toLocaleTimeString()}</div>}
                    </td>
                    <td className="p-4">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => saveProvider(provider)}
                                className="p-2 hover:bg-blue-600/20 text-blue-500 rounded border border-transparent hover:border-blue-600/30 transition"
                                title="حفظ"
                            >
                                <Save size={16} />
                            </button>
                            <button 
                                onClick={() => testConnection(provider)}
                                disabled={testingId === provider.id}
                                className="p-2 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition disabled:opacity-50"
                                title="اختبار الاتصال"
                            >
                                <RefreshCw size={16} className={testingId === provider.id ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default Providers;