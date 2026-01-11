
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Terminal, Wrench, Play, Activity, MessageSquare, Loader2, Minimize2 } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../services/storageService';
import { server } from '../services/serverOrchestrator';
import { JobStatus } from '../types';

interface Message {
    role: 'user' | 'model' | 'system';
    text: string;
    isTool?: boolean;
}

const SystemAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'مرحباً، أنا وكيل النظام (Core OS Agent). يمكنني تشخيص الأخطاء، بدء عمليات الإنتاج، أو تعديل الإعدادات. بماذا أساعدك؟' }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // --- TOOLS DEFINITION ---
    const tools = [{
        functionDeclarations: [
            {
                name: "get_system_status",
                description: "Get the current health status of the video factory, including active and failed jobs.",
            },
            {
                name: "fix_failed_jobs",
                description: "Attempts to repair and restart all jobs that are currently in a FAILED state.",
            },
            {
                name: "start_production_job",
                description: "Starts a new video production job for a specific topic.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING, description: "The topic of the video" },
                        type: { type: Type.STRING, description: "Type of video: 'Shorts' or 'Long'", enum: ["Shorts", "Long"] }
                    },
                    required: ["topic"]
                }
            }
        ]
    }];

    // --- EXECUTION LOGIC ---
    const executeAction = async (functionCall: any): Promise<string> => {
        const { name, args } = functionCall;
        
        try {
            if (name === 'get_system_status') {
                const jobs = await db.getJobs();
                const failed = jobs.filter(j => j.status === JobStatus.FAILED).length;
                const running = jobs.filter(j => j.status === JobStatus.RUNNING).length;
                const completed = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
                return JSON.stringify({ active_jobs: running, failed_jobs: failed, completed_today: completed, system_health: failed > 0 ? "Degraded" : "Healthy" });
            }
            
            if (name === 'fix_failed_jobs') {
                const jobs = await db.getJobs();
                const failedJobs = jobs.filter(j => j.status === JobStatus.FAILED);
                if (failedJobs.length === 0) return "No failed jobs found to fix.";
                
                let fixedCount = 0;
                for (const job of failedJobs) {
                    // Reset job to pending and clear error
                    const lastStepIndex = Math.max(0, job.currentStepIndex - 1); // Retry previous step
                    const updatedSteps = [...job.steps];
                    updatedSteps[job.currentStepIndex].status = JobStatus.PENDING;
                    updatedSteps[job.currentStepIndex].errorMessage = undefined;
                    
                    await db.saveJob({
                        ...job,
                        status: JobStatus.RUNNING,
                        steps: updatedSteps,
                        currentStepIndex: lastStepIndex
                    });
                    // Re-trigger server processing (This is a simplified restart logic)
                    server['processJob'](job.id); 
                    fixedCount++;
                }
                return `Successfully restarted ${fixedCount} failed jobs. Monitoring resumed.`;
            }

            if (name === 'start_production_job') {
                const type = args.type || 'Shorts';
                const topic = args.topic;
                // Construct a basic pipeline setup similar to Production.tsx
                // For simplicity, we create a basic config here
                const jobId = await server.startJob({
                    title: topic,
                    type: type as any,
                    steps: [
                        { id: 'ai1', agentRole: 'StrategyDirector' as any, name: 'AI Strategy', status: JobStatus.PENDING, retryCount: 0 },
                        { id: 'ai2', agentRole: 'ScriptBuilder' as any, name: 'AI Scripting', status: JobStatus.PENDING, retryCount: 0 },
                        { id: 'ai3', agentRole: 'VisualProducer' as any, name: 'AI Visuals', status: JobStatus.PENDING, retryCount: 0 },
                        { id: 'ai4', agentRole: 'EditorAssembler' as any, name: 'Assembly', status: JobStatus.PENDING, retryCount: 0 }
                    ],
                    durationConfig: { mode: 'fixed', unit: 'minutes', target_value: 1 }, // Default
                    visualConfig: { mode: 'images', provider: 'nano_banana', fallback: 'images', quality: 'standard', aspectRatio: '16:9' }
                });
                return `Job started successfully. ID: ${jobId}. Topic: ${topic}`;
            }

            return "Function not found.";
        } catch (e: any) {
            return `Error executing tool: ${e.message}`;
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsThinking(true);

        try {
            // Get Key
            const providers = await db.getProviders();
            const apiKey = providers.find(p => p.providerId === 'gemini')?.apiKey;
            
            if (!apiKey) {
                setMessages(prev => [...prev, { role: 'system', text: 'Error: Gemini API Key is missing. Please configure it in Providers.' }]);
                setIsThinking(false);
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            
            // Generate Content with Tools
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Fast model for tool use
                contents: [
                    { role: 'user', parts: [{ text: `System Context: You are the OS Assistant. User says: ${userMsg}` }] }
                ],
                config: {
                    tools: tools,
                    systemInstruction: "You are an advanced System Assistant for an automated video factory. You are concise, technical, and helpful. If the user reports a problem, check system status or fix jobs. If they want to make a video, start a job."
                }
            });

            // Handle Response
            const candidate = response.candidates?.[0];
            
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    // 1. Handle Function Call
                    if (part.functionCall) {
                        setMessages(prev => [...prev, { role: 'system', text: `Executing: ${part.functionCall.name}...`, isTool: true }]);
                        
                        const resultText = await executeAction(part.functionCall);
                        
                        // Feed result back to model (Simplified: just showing result to user for this UI)
                        setMessages(prev => [...prev, { role: 'system', text: `Result: ${resultText}`, isTool: true }]);
                        
                        // Optional: Multi-turn loop could go here to let model explain the result
                        // For now, we just append a generic success message if it was an action
                        if (!part.functionCall.name.includes('get')) {
                             setMessages(prev => [...prev, { role: 'model', text: 'تم تنفيذ العملية بنجاح.' }]);
                        } else {
                             // If it was a query, we need the model to interpret the JSON result
                             // Re-prompting model with result (Quick Implementation)
                             const summaryResponse = await ai.models.generateContent({
                                 model: 'gemini-2.5-flash',
                                 contents: [{ role: 'user', parts: [{ text: `Interpret this system data for the user: ${resultText}` }] }]
                             });
                             setMessages(prev => [...prev, { role: 'model', text: summaryResponse.text || 'Done.' }]);
                        }
                    } 
                    // 2. Handle Text Response
                    else if (part.text) {
                        setMessages(prev => [...prev, { role: 'model', text: part.text }]);
                    }
                }
            }

        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'system', text: `Connection Error: ${e.message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-96 h-[500px] bg-slate-950/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden ring-1 ring-blue-500/20">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-transparent flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bot size={20} className="text-blue-400" />
                            <div>
                                <h3 className="font-bold text-white text-sm">System Architect</h3>
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                                    <span className="text-[10px] text-slate-400">Online • Gemini 2.5</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
                            <Minimize2 size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                                    msg.isTool ? 'bg-slate-900/50 border border-dashed border-slate-700 text-slate-400 font-mono text-xs w-full' :
                                    'bg-slate-800 text-slate-200 rounded-bl-none'
                                }`}>
                                    {msg.isTool && <Terminal size={12} className="inline-block mr-1 mb-0.5" />}
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 rounded-xl p-3 rounded-bl-none flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-blue-400" />
                                    <span className="text-xs text-slate-400">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-slate-900 border-t border-white/5">
                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-blue-500/50 transition">
                            <input 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="اطلب إصلاح الأخطاء، إنشاء فيديو..."
                                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500"
                            />
                            <button 
                                onClick={handleSend}
                                disabled={isThinking || !input}
                                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-800 transition"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center relative group ${
                    isOpen ? 'bg-slate-800 text-slate-400 rotate-90' : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-110'
                }`}
            >
                {isOpen ? <X size={24} /> : <Bot size={28} />}
                
                {!isOpen && (
                    <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition translate-x-2 group-hover:translate-x-0">
                        مساعد النظام
                    </span>
                )}
            </button>
        </div>
    );
};

export default SystemAssistant;
