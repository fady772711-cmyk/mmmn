
import React, { useState, useEffect } from 'react';
import { db } from '../services/storageService';
import { Shield, Lock, Server, Database, Save, Activity, RefreshCw } from 'lucide-react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'security' | 'server' | 'advanced'>('security');
  
  // Security State
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Server State
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
      loadSettings();
  }, []);

  const loadSettings = async () => {
      const auth = await db.getAuthSettings();
      setSecurityEnabled(auth.enabled);
      if (auth.username) setUsername(auth.username);
      
      const app = await db.getAppSettings();
      setServerUrl(app.serverUrl);
      setServerStatus(app.serverStatus);
  };

  const saveSecurity = async () => {
      await db.saveAuthSettings({
          enabled: securityEnabled,
          username,
          passwordHash: password, // In prod, hash this!
          lockAfterMinutes: 30
      });
      alert("تم حفظ إعدادات الأمان. سيتم قفل الواجهة عند إعادة التحميل.");
  };

  const checkServer = async () => {
      setServerStatus('disconnected');
      try {
          // Mock ping
          await new Promise(r => setTimeout(r, 1000));
          // if real: await fetch(serverUrl + '/health');
          setServerStatus('connected');
      } catch (e) {
          setServerStatus('disconnected');
      }
      await db.saveAppSettings({ serverUrl, serverStatus: 'connected', theme: 'dark', debugMode: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">إعدادات النظام (Settings)</h2>
          <p className="text-slate-400">تكوين الأمان، السيرفر، والخيارات المتقدمة</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800">
          {['security', 'server', 'advanced'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                  {tab === 'security' && <span className="flex items-center gap-2"><Shield size={16}/> الأمان والحماية</span>}
                  {tab === 'server' && <span className="flex items-center gap-2"><Server size={16}/> إعدادات السيرفر</span>}
                  {tab === 'advanced' && <span className="flex items-center gap-2"><Database size={16}/> خيارات متقدمة</span>}
              </button>
          ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[400px]">
          {activeTab === 'security' && (
              <div className="max-w-xl space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div>
                          <h3 className="font-bold text-white">قفل الواجهة (Lock UI)</h3>
                          <p className="text-xs text-slate-500">تفعيل شاشة تسجيل الدخول لحماية لوحة التحكم.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={securityEnabled}
                            onChange={(e) => setSecurityEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                  </div>

                  {securityEnabled && (
                      <div className="space-y-4 animate-in fade-in">
                          <div>
                              <label className="block text-sm text-slate-400 mb-2">Username</label>
                              <input 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                              />
                          </div>
                          <div>
                              <label className="block text-sm text-slate-400 mb-2">Password</label>
                              <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                              />
                          </div>
                      </div>
                  )}

                  <button onClick={saveSecurity} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                      <Save size={18} /> حفظ الإعدادات
                  </button>
              </div>
          )}

          {activeTab === 'server' && (
              <div className="max-w-xl space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                      <div className={`p-3 rounded-full ${serverStatus === 'connected' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          <Activity size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-white">حالة الاتصال (Connection Status)</h3>
                          <p className={`text-sm ${serverStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                              {serverStatus === 'connected' ? 'Connected to Backend' : 'Disconnected'}
                          </p>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm text-slate-400 mb-2">Backend Server URL</label>
                      <input 
                        value={serverUrl}
                        onChange={e => setServerUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white font-mono"
                      />
                  </div>

                  <button onClick={checkServer} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                      <RefreshCw size={18} /> اختبار وربط
                  </button>
              </div>
          )}

          {activeTab === 'advanced' && (
              <div className="max-w-xl space-y-6">
                  <div className="p-4 border border-red-900/50 bg-red-900/10 rounded-lg">
                      <h3 className="font-bold text-red-400 flex items-center gap-2"><Database size={18} /> منطقة الخطر</h3>
                      <p className="text-xs text-red-300 mt-1">هذه الإجراءات لا يمكن التراجع عنها.</p>
                      
                      <div className="mt-4 flex gap-4">
                          <button 
                            onClick={() => { if(confirm("Clear local storage?")) { localStorage.clear(); window.location.reload(); } }}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
                          >
                              مسح كافة البيانات (Reset App)
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default Settings;
