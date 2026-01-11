
import React, { useState, useRef } from 'react';
import { Play, Pause, Music, Search, Tag, Volume2 } from 'lucide-react';
import { MOCK_MUSIC_LIBRARY } from '../../services/mockData';
import InlineCopilot from '../../components/InlineCopilot';

const MusicLibrary: React.FC = () => {
  const [tracks, setTracks] = useState(MOCK_MUSIC_LIBRARY);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = (track: any) => {
    if (playingTrackId === track.id) {
        audioRef.current?.pause();
        setPlayingTrackId(null);
    } else {
        if (audioRef.current) {
            audioRef.current.src = track.url;
            audioRef.current.play();
        } else {
            const audio = new Audio(track.url);
            audioRef.current = audio;
            audio.play();
        }
        setPlayingTrackId(track.id);
    }
  };

  const handleCopilotAction = (action: string, payload: any) => {
      if (action === 'filter_tracks') {
          // Payload contains suggested filters (mood, genre)
          // We simulate filtering
          const mood = payload.mood?.toLowerCase();
          if (mood) {
              const filtered = MOCK_MUSIC_LIBRARY.filter(t => 
                  t.mood?.toLowerCase().includes(mood) || 
                  t.tags.some(tag => tag.toLowerCase().includes(mood))
              );
              setTracks(filtered);
          }
      }
  };

  const COPILOT_PROMPT = `You are a Music Supervisor Agent.
  Your goal is to help the user find the perfect track for their video.
  
  Available Tracks (simulated knowledge):
  ${MOCK_MUSIC_LIBRARY.map(t => `- ${t.title} (${t.mood}, ${t.tags.join(',')})`).join('\n')}
  
  User will ask: "I need music for a sad documentary" or "Something fast for sports".
  
  Action: 'filter_tracks'
  Payload: { "mood": "Sad" | "Energetic" | "Cinematic", "reasoning": "..." }
  
  Response: Explain why these tracks fit.`;

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Main Library */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Music className="text-purple-500" /> مكتبة الموسيقى
                </h2>
                <p className="text-slate-400 text-sm">متصل بـ YouTube Audio Library (Simulation)</p>
            </div>
            <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    placeholder="بحث في المسارات..." 
                    className="bg-slate-900 border border-slate-700 rounded-lg pr-9 pl-4 py-2 text-sm text-white w-64 outline-none focus:border-purple-500"
                />
            </div>
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-y-auto custom-scrollbar">
            <table className="w-full text-right text-sm">
                <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                        <th className="p-4">Track</th>
                        <th className="p-4">Mood</th>
                        <th className="p-4">Tags</th>
                        <th className="p-4">Duration</th>
                        <th className="p-4">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {tracks.map(track => (
                        <tr key={track.id} className={`group hover:bg-slate-800/50 transition ${playingTrackId === track.id ? 'bg-purple-900/10' : ''}`}>
                            <td className="p-4 font-medium text-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${playingTrackId === track.id ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                        <Music size={14} />
                                    </div>
                                    {track.title}
                                </div>
                            </td>
                            <td className="p-4 text-slate-400">{track.mood}</td>
                            <td className="p-4">
                                <div className="flex gap-1 flex-wrap">
                                    {track.tags.map(t => (
                                        <span key={t} className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 border border-slate-700">{t}</span>
                                    ))}
                                </div>
                            </td>
                            <td className="p-4 text-slate-500 font-mono">02:30</td>
                            <td className="p-4">
                                <button 
                                    onClick={() => handlePlay(track)}
                                    className={`p-2 rounded-full border transition ${playingTrackId === track.id ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-600 text-slate-400 hover:text-white'}`}
                                >
                                    {playingTrackId === track.id ? <Pause size={14} /> : <Play size={14} />}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {tracks.length === 0 && <div className="p-8 text-center text-slate-500">لا توجد مسارات مطابقة</div>}
        </div>
      </div>

      {/* Copilot Sidebar */}
      <div className="w-80 shrink-0">
          <InlineCopilot 
              title="Music Agent"
              subtitle="وكيل اختيار الموسيقى"
              systemPrompt={COPILOT_PROMPT}
              placeholder="اطلب موسيقى مناسبة لفيديوهاتك..."
              onAction={handleCopilotAction}
          />
      </div>
    </div>
  );
};

export default MusicLibrary;
