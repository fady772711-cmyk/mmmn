
import React, { useEffect, useState } from 'react';
import { VoicePreset } from '../../types';
import { db } from '../../services/storageService';
import { generateSpeech } from '../../services/geminiService';
import { Play, Mic, Plus, Trash2, Loader2, Save } from 'lucide-react';
import InlineCopilot from '../../components/InlineCopilot';

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

  // --- COPILOT INTEGRATION ---
  const handleCopilotAction = async (action: string, payload: any) => {
      if (action === 'create_voice_preset') {
          // Payload: { name, nativeVoiceId, gender, style, languageCode }
          const newVoice: VoicePreset = {
              id: `voice_ai_${Date.now()}`,
              providerId: 'prov_1', // Force Gemini for now
              name: payload.name || "AI Generated Voice",
              nativeVoiceId: payload.nativeVoiceId || "Kore",
              gender: payload.gender || "Male",
              style: payload.style || "Standard",
              languageCode: payload.languageCode || "ar-SA"
          };
          await db.saveVoice(newVoice);
          setVoices(prev => [...prev, newVoice]);
      }
  };

  const VOICE_ARCHITECT_PROMPT = `You are a Voice Engineer/Architect Agent.
  Your goal is to create Voice Presets based on user description.
  
  Available Base Models (Gemini TTS): ['Puck' (Male, Energetic), 'Charon' (Male, Deep/Scary), 'Kore' (Female, Neutral/News), 'Fenrir' (Male, Authoritative), 'Zephyr' (Female, Calm)].
  
  User Request: "Make an Egyptian News Anchor voice".
  Logic: Map "Egyptian" to 'ar-EG', "News Anchor" to 'Kore' or 'Fenrir', style "Professional".
  
  Action: 'create_voice_preset'
  Payload: {
    "name": "Egyptian News Anchor",
    "nativeVoiceId": "Kore",
    "gender": "Female",
    "style": "News/Professional",
    "languageCode": "ar-EG"
  }
  
  User Request: "Scary storyteller for horror channel".
  Payload: { "name": "Horror Narrator", "nativeVoiceId": "Charon", "style": "Terrifying", "languageCode": "ar-SA" }`;

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Main List */}
      <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voices.map(voice => (
                <div key={voice.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition relative group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${voice.id.includes('ai') ? 'bg-purple-500/10 text-purple-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                <Mic size={20} />
                            </div>
                            <div>
                                <input 
                                    value={voice.name}
                                    onChange={(e) => updateVoice(voice.id, { name: e.target.value })}
                                    className="bg-transparent font-bold text-slate-200 w-full border-none p-0 focus:ring-0"
                                />
                                <p className="text-xs text-slate-500">{voice.style} • {voice.languageCode}</p>
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

      {/* Copilot Sidebar */}
      <div className="w-80 shrink-0">
          <InlineCopilot 
              title="Voice Architect"
              subtitle="مهندس الأصوات الذكي"
              systemPrompt={VOICE_ARCHITECT_PROMPT}
              placeholder="مثال: اصنع صوت معلق وثائقي عميق..."
              onAction={handleCopilotAction}
          />
      </div>
    </div>
  );
};

export default Voices;
