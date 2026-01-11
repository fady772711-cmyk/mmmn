
import React, { useState } from 'react';
import { BarChart3, Search, TrendingUp, Users, Eye, PlayCircle } from 'lucide-react';
import InlineCopilot from '../components/InlineCopilot';

const Analytics: React.FC = () => {
    const [channelInput, setChannelInput] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [mockData, setMockData] = useState<any>(null);

    // Prompt for the Analyst Copilot
    const ANALYST_PROMPT = `You are a Senior YouTube Strategist & Analyst.
Your goal is to help the user grow their channel.
You can "analyze" a channel by simulating a deep dive into its niche.

If the user asks to analyze a specific channel (e.g., "Analyze channel X" or "Check my audience"), output JSON:
{
  "action": "analyze_channel",
  "payload": { "channelName": "The Channel Name" },
  "responseToUser": "I'm pulling data for [Channel Name]... Let's look at the metrics."
}

If the user asks for niche suggestions, output JSON:
{
  "action": "suggest_niches",
  "payload": { "category": "General" },
  "responseToUser": "Here are some high-RPM, high-growth niches right now."
}

Otherwise, answer strategically as an expert.`;

    const handleCopilotAction = (action: string, payload: any) => {
        if (action === 'analyze_channel') {
            setChannelInput(payload.channelName);
            handleSimulatedAnalysis();
        }
        if (action === 'suggest_niches') {
             // Just show a text response in chat mostly, but we could trigger a UI modal
        }
    };

    const handleSimulatedAnalysis = () => {
        setAnalyzing(true);
        // Simulate API delay
        setTimeout(() => {
            setMockData({
                views: '1.2M',
                subs: '+5.4K',
                ctr: '4.8%',
                retention: '45%',
                topVideos: [
                    { title: 'Why AI is taking over', views: '450K' },
                    { title: 'Hidden History of Rome', views: '120K' }
                ]
            });
            setAnalyzing(false);
        }, 2000);
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-6">
            {/* Left: Dashboard Area */}
            <div className="flex-1 space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">التحليلات والاستراتيجية</h2>
                    <p className="text-slate-400">تحليل الأداء واكتشاف الفرص بمساعدة الذكاء الاصطناعي</p>
                </div>

                {/* Search Bar */}
                <div className="flex gap-2">
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg flex items-center px-4">
                        <Search className="text-slate-500" />
                        <input 
                            value={channelInput}
                            onChange={e => setChannelInput(e.target.value)}
                            placeholder="أدخل رابط القناة أو المعرف لتحليلها..."
                            className="flex-1 bg-transparent border-none outline-none text-white p-3"
                        />
                    </div>
                    <button 
                        onClick={handleSimulatedAnalysis}
                        disabled={analyzing}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition disabled:opacity-50"
                    >
                        {analyzing ? 'جاري التحليل...' : 'تحليل'}
                    </button>
                </div>

                {/* Results Area */}
                {mockData ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-slate-500 text-xs mb-1">Total Views</p>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Eye size={20} className="text-blue-500" /> {mockData.views}
                                </h3>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-slate-500 text-xs mb-1">Subscribers</p>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Users size={20} className="text-green-500" /> {mockData.subs}
                                </h3>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-slate-500 text-xs mb-1">Avg CTR</p>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <PlayCircle size={20} className="text-amber-500" /> {mockData.ctr}
                                </h3>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-slate-500 text-xs mb-1">Avg Retention</p>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp size={20} className="text-purple-500" /> {mockData.retention}
                                </h3>
                            </div>
                        </div>

                        {/* Top Videos */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h3 className="font-bold text-white mb-4">Top Performing Videos (Last 28d)</h3>
                            <div className="space-y-3">
                                {mockData.topVideos.map((vid: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-500 font-mono">#{i+1}</span>
                                            <span className="text-slate-200">{vid.title}</span>
                                        </div>
                                        <span className="text-blue-400 font-bold">{vid.views}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                        <BarChart3 size={48} className="opacity-20 mb-4" />
                        <p>أدخل اسم قناة أو اطلب من المساعد الذكي تحليل قناتك.</p>
                    </div>
                )}
            </div>

            {/* Right: Copilot Sidebar */}
            <div className="w-full md:w-96 shrink-0">
                <InlineCopilot 
                    title="Analyst Copilot"
                    subtitle="مستشارك الاستراتيجي للنمو"
                    systemPrompt={ANALYST_PROMPT}
                    onAction={handleCopilotAction}
                    placeholder="اسألني: ما هو أفضل نيتش حالياً؟"
                />
            </div>
        </div>
    );
};

export default Analytics;
