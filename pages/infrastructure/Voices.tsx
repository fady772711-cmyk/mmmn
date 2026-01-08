import React, { useEffect, useState } from 'react';
import { VoicePreset } from '../../types';
import { db } from '../../services/storageService';
import { generateSpeech } from '../../services/geminiService';
import { Play, Mic, Plus, Trash2, Loader2, Save } from 'lucide-react';

const ALLOWED_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

const Voices: React.FC = () => {
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [testText, setTestText] = useState("مرحباً، هذا اختبار للصوت العربي من Gemini.");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.getVoices();
    setVoices(data);
    setLoading(false);
  };

  const addVoice = async () => {
    const newVoice: VoicePreset = {
        id: `voice_${Date.now()}`,
        name: 'New Voice Config',
        providerId: 'prov_1', // Gemini
        nativeVoiceId: 'Kore',
        gender: 'Male',
        style: 'Neutral',
        languageCode: 'ar-SA'
    };
    await db.saveVoice(newVoice);
    loadData();
  };

  const updateVoice = async (id: string, updates: Partial<VoicePreset>) => {
      const updated = voices.map(v => v.id === id ? { ...v, ...updates } : v);
      setVoices(updated);
      const voice = updated.find(v => v.id === id);
      if(voice) await db.saveVoice(voice);
  };

  const deleteVoice = async (id: string) => {
    setVoices(prev => prev.filter(v => v.id !== id));
    // In real app call db.deleteVoice(id)
  };

  const handleTestVoice = async (voice: VoicePreset) => {
    setTestingVoiceId(voice.id);
    try {
        const blob = await generateSpeech(testText, voice.nativeVoiceId);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    } catch (e) {
        alert("فشل توليد الصوت: تأكد من مفتاح API في المزودات");
        console.error(e);
    } finally {
        setTestingVoiceId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">مكتبة الأصوات</h2>
          <p className="text-slate-400">إدارة النماذج الصوتية المخصصة للقنوات</p>
        </div>
        <button onClick={addVoice} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
            <Plus size={18} />
            <span>إضافة صوت</span>
        </button>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center gap-4">
          <label className="text-sm text-slate-500">نص التجربة:</label>
          <input 
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {voices.map(voice => (
            <div key={voice.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition relative group">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                            <Mic size={20} />
                        </div>
                        <div>
                            <input 
                                value={voice.name}
                                onChange={(e) => updateVoice(voice.id, { name: e.target.value })}
                                className="bg-transparent font-bold text-slate-200 w-full border-none p-0 focus:ring-0"
                            />
                            <p className="text-xs text-slate-500">Gemini TTS</p>
                        </div>
                    </div>
                    <button onClick={() => deleteVoice(voice.id)} className="text-slate-600 hover:text-red-500">
                        <Trash2 size={16} />
                    </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg mb-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Voice ID</span>
                        <select 
                            value={voice.nativeVoiceId}
                            onChange={(e) => updateVoice(voice.id, { nativeVoiceId: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1"
                        >
                            {ALLOWED_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <button 
                    onClick={() => handleTestVoice(voice)}
                    disabled={testingVoiceId === voice.id}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center gap-2 transition text-sm disabled:opacity-50"
                >
                    {testingVoiceId === voice.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    <span>{testingVoiceId === voice.id ? 'جاري التوليد...' : 'تجربة الصوت'}</span>
                </button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Voices;