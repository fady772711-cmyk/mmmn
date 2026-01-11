
import React, { useState, useRef, useEffect } from 'react';
import { adminArabic } from '../services/admin/adminDirectorArabic';
import { AdminMessage, AdminPlan } from '../types';
import { Send, Play, ShieldCheck, Terminal, Cpu, PenTool, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const AdminArabic: React.FC = () => {
    const [messages, setMessages] = useState<AdminMessage[]>([]);
    const [input, setInput] = useState('');
    const [currentPlan, setCurrentPlan] = useState<AdminPlan | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        setLoading(true);
        const userText = input;
        setInput('');

        // Optimistic UI
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date().toISOString() }]);

        try {
            const { response, plan } = await adminArabic.chat(userText);
            
            setMessages(prev => [...prev, { 
                id: (Date.now()+1).toString(), 
                role: 'admin', 
                content: response, 
                timestamp: new Date().toISOString() 
            }]);

            if (plan) setCurrentPlan(plan);

        } catch (e: any) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Error: ${e.message}`, timestamp: new Date().toISOString() }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] -m-6 bg-slate-950">
            {/* Left: Chat Interface */}
            <div className="w-1/3 flex flex-col border-r border-slate-800">
                <div className="p-4 bg-slate-900 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-green-500" />
                        المشرف الإداري
                    </h2>
                    <p className="text-xs text-slate-400">نظام التحكم المركزي (Arabic Admin)</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-xl p-3 text-sm whitespace-pre-wrap ${
                                msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                                msg.role === 'system' ? 'bg-red-900/20 text-red-400 border border-red-900/50' :
                                'bg-slate-800 text-slate-200 rounded-bl-none'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && <div className="text-slate-500 text-xs animate-pulse">جاري التفكير...</div>}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="flex gap-2">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="اكتب أمرك هنا... (مثال: ابدأ إنتاج، أصلح الخطأ)"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none text-right"
                            dir="rtl"
                        />
                        <button onClick={handleSend} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg disabled:opacity-50">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Plan Execution Monitor */}
            <div className="flex-1 flex flex-col bg-slate-900/50">
                {currentPlan ? (
                    <div className="p-8 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white">{currentPlan.title}</h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700">ID: {currentPlan.id}</span>
                                    <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs border border-blue-900/50 flex items-center gap-1">
                                        <Cpu size={12} /> {currentPlan.executor}
                                    </span>
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-full font-bold text-sm border ${
                                currentPlan.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                currentPlan.status === 'FAILED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                                {currentPlan.status}
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto">
                            {currentPlan.steps.map((step, idx) => (
                                <div key={step.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                                            step.status === 'SUCCESS' ? 'border-green-500 bg-green-500/10 text-green-500' :
                                            step.status === 'RUNNING' ? 'border-blue-500 bg-blue-500/10 text-blue-500 animate-pulse' :
                                            step.status === 'FAILED' ? 'border-red-500 bg-red-500/10 text-red-500' :
                                            'border-slate-700 text-slate-500'
                                        }`}>
                                            {step.status === 'SUCCESS' ? <CheckCircle2 size={16} /> : idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-slate-200">{step.description}</h4>
                                            <code className="text-xs text-slate-500 font-mono mt-1 block">{step.command}</code>
                                        </div>
                                    </div>
                                    
                                    {/* Logs Area */}
                                    {step.logs && step.logs.length > 0 && (
                                        <div className="mt-4 bg-black/50 rounded-lg p-3 text-xs font-mono text-slate-400 overflow-x-auto">
                                            {step.logs.map((log, i) => (
                                                <div key={i} className="border-l-2 border-slate-700 pl-2 mb-1">{log}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <PenTool size={64} className="mb-4" />
                        <p className="text-lg">لا توجد خطة نشطة حالياً</p>
                        <p className="text-sm">تحدث مع المشرف لبدء مهمة جديدة</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminArabic;
