
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, User, Terminal } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db } from '../services/storageService';

interface Message {
    role: 'user' | 'model';
    text: string;
    isCommand?: boolean;
}

interface InlineCopilotProps {
    title: string;
    subtitle?: string;
    systemPrompt: string;
    onAction?: (actionType: string, data: any) => void;
    placeholder?: string;
    compact?: boolean;
}

const InlineCopilot: React.FC<InlineCopilotProps> = ({ title, subtitle, systemPrompt, onAction, placeholder, compact }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsThinking(true);

        try {
            const providers = await db.getProviders();
            const apiKey = providers.find(p => p.providerId === 'gemini')?.apiKey;
            
            if (!apiKey) {
                setMessages(prev => [...prev, { role: 'model', text: 'خطأ: يرجى إضافة مفتاح Gemini API في الإعدادات.' }]);
                setIsThinking(false);
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            
            // We append the conversation history for context
            const historyText = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
            const fullPrompt = `${systemPrompt}\n\nHistory:\n${historyText}\nUser: ${userMsg}\n\nRespond strictly in JSON if an action is required, otherwise plain text.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt
            });

            const text = response.text || '';
            
            // Check for JSON action
            let displayText = text;
            try {
                // Try to extract JSON
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const data = JSON.parse(jsonStr);
                    
                    if (data.action && onAction) {
                        onAction(data.action, data.payload);
                        displayText = data.responseToUser || "تم تنفيذ طلبك.";
                    } else if (onAction) {
                         // Fallback if structure is just data without action wrapper
                         onAction('update_config', data);
                         displayText = "تم تحديث الإعدادات بناءً على طلبك.";
                    }
                }
            } catch (e) {
                // Not JSON, just text conversation
            }

            setMessages(prev => [...prev, { role: 'model', text: displayText }]);

        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'model', text: `خطأ في الاتصال: ${e.message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className={`flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden ${compact ? 'h-[400px]' : 'h-[600px]'}`}>
            {/* Header */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex items-center gap-3">
                <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">
                    <Bot size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                        <Sparkles size={32} className="mb-2" />
                        <p className="text-sm">كيف يمكنني مساعدتك اليوم؟</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800 rounded-xl p-3 rounded-bl-none flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-400" />
                            <span className="text-xs text-slate-400">جاري المعالجة...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
                <div className="flex gap-2">
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={placeholder || "اكتب أمرك هنا..."}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isThinking || !input}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InlineCopilot;
