
import React, { useEffect, useState } from 'react';
import { VoicePreset } from '../../types';
import { db } from '../../services/storageService';
import { generateSpeech } from '../../services/geminiService';
import { Play, Mic, Plus, Trash2, Loader2, Save } from 'lucide-react';
import InlineCopilot from '../../components/InlineCopilot';

// Google Gemini Standard Voices
const GOOGLE_VOICES = [
  'achernar', 'achird', 'algenib', 'algieba', 'alnilam', 'aoede', 'autonoe', 'callirrhoe', 
  'charon', 'despina', 'enceladus', 'erinome', 'fenrir', 'gacrux', 'iapetus', 'kore', 
  'laomedeia', 'leda', 'orus', 'puck', 'pulcherrima', 'rasalgethi', 'sadachbia', 
  'sadaltager', 'schedar', 'sulafat', 'umbriel', 'vindemiatrix', 'zephyr', 'zubenelgenubi'
];

// GeminiGen Known Voices
const GEMINIGEN_PRESETS = [
    { id: 'GM001', name: 'GM001 - Standard Male' },
    { id: 'GM002', name: 'GM002 - Standard Female' },
    { id: 'GM003', name: 'GM003 - Soft Male' },
    { id: 'GM004', name: 'GM004 - Soft Female' },
    { id: 'GM005', name: 'GM005 - Strong Male' },
    { id: 'GM013', name: 'GM013 - Gacrux (Deep)' },
    { id: 'GM014', name: 'GM014 - Kore (Clean)' },
    { id: 'GM015', name: 'GM015 - Charon (Story)' },
    { id: 'GM016', name: 'GM016 - Fenrir (Deep)' },
    { id: 'GM017', name: 'GM017 - Puck (News)' }
];

const Voices: React.FC = () => {
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [testText, setTestText] = useState("مرحباً، هذا اختبار للصوت العربي.");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    let data = await db.getVoices();
    setVoices(data);
    setLoading(false);
  };

  const addVoice = async () => {
    const newVoice: VoicePreset = {
        id: `voice_${Date.now()}`,
        name: 'New Voice Config',
        providerId: 'prov_1', // Default to Gemini
        nativeVoiceId: 'kore',
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
    } catch (e: any) {
        alert("فشل توليد الصوت: " + e.message);
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
              providerId: payload.providerId || 'prov_1', 
              name: payload.name || "AI Generated Voice",
              nativeVoiceId: payload.nativeVoiceId || "kore",
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
  
  Available Base Models (Gemini TTS): ['puck', 'charon', 'kore', 'fenrir', 'zephyr', 'aoede', 'eneladus', 'iapetus'].
  
  User Request: "Make an Egyptian News Anchor voice".
  Logic: Map "Egyptian" to 'ar-EG', "News Anchor" to 'kore' or 'fenrir', style "Professional".
  
  Action: 'create_voice_preset'
  Payload: {
    "name": "Egyptian News Anchor",
    "nativeVoiceId": "kore",
    "gender": "Female",
    "style": "News/Professional",
    "languageCode": "ar-EG"
  }
  
  User Request: "Scary storyteller for horror channel".
  Payload: { "name": "Horror Narrator", "nativeVoiceId": "charon", "style": "Terrifying", "languageCode": "ar-SA" }`;

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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${voice.providerId === 'prov_geminigen' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
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

                    <div className="bg-slate-950 p-3 rounded-lg mb-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Provider</span>
                            <select 
                                value={voice.providerId}
                                onChange={(e) => updateVoice(voice.id, { providerId: e.target.value })}
                                className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1"
                            >
                                <option value="prov_1">Google Gemini</option>
                                <option value="prov_geminigen">GeminiGen.AI</option>
                                <option value="prov_3">ElevenLabs</option>
                            </select>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Voice ID</span>
                            {/* Logic to show appropriate dropdown or input based on provider */}
                            {voice.providerId === 'prov_1' ? (
                                <select 
                                    value={voice.nativeVoiceId}
                                    onChange={(e) => updateVoice(voice.id, { nativeVoiceId: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1 w-32"
                                >
                                    {GOOGLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            ) : voice.providerId === 'prov_geminigen' ? (
                                <select 
                                    value={voice.nativeVoiceId}
                                    onChange={(e) => updateVoice(voice.id, { nativeVoiceId: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1 w-32"
                                >
                                    <option value="">Select ID...</option>
                                    {GEMINIGEN_PRESETS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    <option value="custom">Custom ID</option>
                                </select>
                            ) : (
                                <input 
                                    value={voice.nativeVoiceId}
                                    onChange={(e) => updateVoice(voice.id, { nativeVoiceId: e.target.value })}
                                    placeholder="e.g. GM013"
                                    className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1 w-32"
                                />
                            )}
                        </div>
                        {/* Custom Input fallback for GeminiGen */}
                        {voice.providerId === 'prov_geminigen' && !GEMINIGEN_PRESETS.find(p => p.id === voice.nativeVoiceId) && (
                             <div className="flex justify-between items-center text-xs animate-in fade-in">
                                <span className="text-slate-500">Custom ID</span>
                                <input 
                                    value={voice.nativeVoiceId}
                                    onChange={(e) => updateVoice(voice.id, { nativeVoiceId: e.target.value })}
                                    placeholder="e.g. GM099"
                                    className="bg-slate-900 border border-slate-700 rounded text-slate-300 text-xs p-1 w-32"
                                />
                             </div>
                        )}
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
