
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { metricsService } = require('./metrics');

// Simple file-based persistence
const DB_FILE = path.join(__dirname, 'jobs.db.json');
const STORAGE_DIR = path.join(__dirname, 'storage');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

// --- AI CONFIGURATION ---
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper: Quota Safe Generation with Fallback
async function generateSafe(modelName, prompt, config = {}) {
    const modelsToTry = [modelName];
    // Fallback Logic definition
    if (modelName.includes('gemini-3')) {
        if (!modelsToTry.includes('gemini-3-flash-preview')) modelsToTry.push('gemini-3-flash-preview');
        if (!modelsToTry.includes('gemini-2.5-flash')) modelsToTry.push('gemini-2.5-flash');
    }

    let lastError;
    for (const model of modelsToTry) {
        try {
            console.log(`[JobManager] Generating with ${model}...`);
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: config
            });
            return response;
        } catch (e) {
            lastError = e;
            const msg = e.message?.toLowerCase() || '';
            const isQuota = e.status === 429 || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('429');
            if (isQuota) {
                console.warn(`[JobManager] Quota hit for ${model}. trying next...`);
                // Wait a bit longer if quota hit to cool down
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            throw e;
        }
    }
    throw lastError;
}

class JobManager {
    constructor() {
        this.jobs = this.loadJobs();
        this.queue = [];
        this.isProcessing = false;
        
        // Resume pending jobs
        this.jobs.filter(j => j.status === 'PENDING').forEach(j => this.queue.push(j.id));
        this.processQueue();
    }

    loadJobs() {
        if (!fs.existsSync(DB_FILE)) return [];
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }

    saveJobs() {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.jobs, null, 2));
    }

    async triggerDailyBatch() {
        // Logic to trigger batch jobs based on automated schedules
        return [];
    }

    async enqueueJob(type, payload) {
        const jobId = `job_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        
        let steps = payload.steps;
        if (!steps || steps.length === 0) {
            steps = [
                { id: 's1', agentRole: 'StrategyDirector', name: 'Strategy & Angle', status: 'PENDING' },
                { id: 's2', agentRole: 'TitleGenerator', name: 'Viral Titles', status: 'PENDING' },
                { id: 's3', agentRole: 'ScriptBuilder', name: 'Professional Script', status: 'PENDING' },
                { id: 's4', agentRole: 'VisualProducer', name: 'Visual Prompts', status: 'PENDING' },
                { id: 's5', agentRole: 'DescriptionAgent', name: 'SEO Description', status: 'PENDING' },
                { id: 's6', agentRole: 'EditorAssembler', name: 'Final Assembly', status: 'PENDING' } // Added Final Assembly
            ];
        }

        const job = {
            id: jobId,
            type,
            title: payload.title || 'Untitled Job',
            payload,
            triggerType: payload.triggerType || (type === 'smoke_test' ? 'Test' : 'Manual'),
            status: 'PENDING',
            currentStepIndex: 0,
            progress: 0,
            steps: steps,
            artifacts: {}, // Stores context between steps
            logs: [],
            totalCost: 0,
            totalTokens: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.jobs.push(job);
        this.saveJobs();
        this.queue.push(jobId);
        
        this.processQueue();
        metricsService.recordJobEvent(type, 'ENQUEUED');
        
        return jobId;
    }

    async getJob(id) {
        return this.jobs.find(j => j.id === id);
    }

    async getAllJobs() {
        return this.jobs;
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const jobId = this.queue.shift();
        const job = this.jobs.find(j => j.id === jobId);

        if (job) {
            await this.runJobPipeline(job);
        }

        this.isProcessing = false;
        this.processQueue(); 
    }

    async runJobPipeline(job) {
        job.status = 'RUNNING';
        job.startedAt = new Date().toISOString();
        this.saveJobs();

        try {
            for (let i = 0; i < job.steps.length; i++) {
                const step = job.steps[i];
                
                // Skip if already done (for resuming)
                if (step.status === 'COMPLETED') continue;

                job.currentStepIndex = i;
                step.status = 'RUNNING';
                this.saveJobs();

                // Check for Smoke Test Simulation Mode
                if (job.type === 'smoke_test') {
                    await this.executeMockStep(job, step);
                } else {
                    await this.executeStep(job, step);
                }

                step.status = 'COMPLETED';
                job.progress = Math.round(((i + 1) / job.steps.length) * 100);
                this.saveJobs();
                
                // Throttling
                await new Promise(r => setTimeout(r, 2000));
            }

            job.status = 'COMPLETED';
            job.finishedAt = new Date().toISOString();
            metricsService.recordJobEvent(job.type, 'SUCCESS', (new Date() - new Date(job.startedAt)));

        } catch (e) {
            console.error(`Job ${job.id} Failed:`, e);
            job.status = 'FAILED';
            job.error = e.message;
            if (job.steps[job.currentStepIndex]) {
                job.steps[job.currentStepIndex].status = 'FAILED';
                job.steps[job.currentStepIndex].errorMessage = e.message;
            }
            job.finishedAt = new Date().toISOString();
            metricsService.recordJobEvent(job.type, 'FAILURE');
        }

        this.saveJobs();
    }

    // --- MOCK EXECUTION (NO API USAGE) ---
    async executeMockStep(job, step) {
        console.log(`[Job ${job.id}] Executing MOCK ${step.agentRole}...`);
        await new Promise(r => setTimeout(r, 1000)); // Simulate work

        if (step.agentRole === 'StrategyDirector') {
            job.artifacts.strategy = { angle: "Mock Angle: The Hidden Truth", hook: "Did you know coffee was once illegal?", tone: "Dramatic" };
            step.outputSummary = "Mock Strategy Generated";
            step.artifacts = [{ label: 'Strategy JSON', type: 'json', content: JSON.stringify(job.artifacts.strategy) }];
        } 
        else if (step.agentRole === 'TitleGenerator') {
            job.artifacts.titles = ["The Dark History of Coffee", "Why Kings Banned Coffee", "Coffee: The Devil's Drink"];
            step.outputSummary = "Mock Titles Generated";
            step.artifacts = [{ label: 'Titles List', type: 'json', content: JSON.stringify({ titles: job.artifacts.titles }) }];
        }
        else if (step.agentRole === 'ScriptBuilder') {
            job.artifacts.script = "Title: The Dark History of Coffee\n\nIntro: It starts in 1511. Coffee was banned in Mecca.\n\nBody: Why? Because it made people think.\n\nOutro: Next time you sip, remember the rebels.";
            step.outputSummary = "Mock Script Generated";
            step.artifacts = [{ label: 'Full Script', type: 'text', content: job.artifacts.script }];
        }
        else if (step.agentRole === 'VisualProducer') {
            const prompts = ["Ancient coffee house in Mecca, 1511", "Angry Sultan forbidding coffee", "Modern latte art close up"];
            const mockImages = prompts.map((p, i) => ({
                label: `Scene ${i+1}`,
                type: 'image',
                url: `https://placehold.co/600x400/2a1b0e/FFF?text=${encodeURIComponent(p.substring(0, 20))}`
            }));
            step.outputSummary = "Mock Visuals Created";
            step.artifacts = [
                { label: 'Prompts JSON', type: 'json', content: JSON.stringify({ prompts }) },
                ...mockImages
            ];
        }
        else if (step.agentRole === 'DescriptionAgent') {
            step.outputSummary = "Mock Description Ready";
            step.artifacts = [{ label: 'Video Description', type: 'text', content: "Discover the forbidden history of your morning brew. #Coffee #History" }];
        }
        else if (step.agentRole === 'EditorAssembler') {
            // Mock Video Assembly
            // Use a reliable sample video URL for demonstration
            const sampleVideo = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
            job.artifacts.finalVideoUrl = sampleVideo;
            step.outputSummary = "Final Video Assembled (Simulation)";
            step.artifacts = [{ label: 'Final Video', type: 'video', url: sampleVideo }];
        }
        
        job.logs.push({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            agent: step.agentRole,
            message: `[MOCK] ${step.name} completed successfully.`
        });
    }

    // --- REAL AI EXECUTION ENGINE ---
    async executeStep(job, step) {
        if (!ai) {
            throw new Error("SERVER_MODE_ERROR: API_KEY is missing in server environment.");
        }

        console.log(`[Job ${job.id}] Executing ${step.agentRole}...`);
        
        const context = {
            topic: job.title,
            strategy: job.artifacts.strategy,
            titles: job.artifacts.titles,
            script: job.artifacts.script,
            duration: job.payload.durationConfig?.target_value || 5
        };

        const defaultModel = 'gemini-3-flash-preview'; 
        let resultText = "";

        try {
            if (step.agentRole === 'StrategyDirector') {
                const prompt = `
                Role: Senior YouTube Strategist.
                Task: Define a viral strategy for a video about "${context.topic}".
                Constraint: Video Type is ${job.type}. Target Audience: General.
                Output JSON: { "hook": "A curiosity-inducing hook sentence", "angle": "Unique perspective", "tone": "Emotional/Dramatic/Educational" }
                Ensure the output is in Arabic language.
                `;
                const response = await generateSafe(defaultModel, prompt, { responseMimeType: 'application/json' });
                resultText = response.text;
                job.artifacts.strategy = JSON.parse(resultText);
                step.outputSummary = "Strategy Defined: " + job.artifacts.strategy.angle;
                step.artifacts = [{ label: 'Strategy JSON', type: 'json', content: resultText }];
            } 
            else if (step.agentRole === 'TitleGenerator') {
                const prompt = `
                Role: YouTube Title Expert.
                Context: Topic "${context.topic}", Angle "${context.strategy?.angle}".
                Task: Generate 5 high-CTR Arabic titles.
                Output JSON: { "titles": ["Title 1", "Title 2", ...] }
                `;
                const response = await generateSafe(defaultModel, prompt, { responseMimeType: 'application/json' });
                resultText = response.text;
                job.artifacts.titles = JSON.parse(resultText).titles;
                step.outputSummary = "Generated 5 Titles";
                step.artifacts = [{ label: 'Titles List', type: 'json', content: resultText }];
            }
            else if (step.agentRole === 'ScriptBuilder') {
                const selectedTitle = context.titles ? context.titles[0] : context.topic;
                const prompt = `
                Role: Professional Scriptwriter.
                Task: Write a full script for "${selectedTitle}".
                Style: ${context.strategy?.tone || 'Engaging'}.
                Structure: Intro (Hook), Body (3 Key Points), Outro (Call to Action).
                Language: Arabic (Professional yet accessible).
                Output Plain Text with clear section headers.
                `;
                const response = await generateSafe('gemini-3-pro-preview', prompt); 
                resultText = response.text;
                job.artifacts.script = resultText;
                step.outputSummary = "Full Script Generated";
                step.artifacts = [{ label: 'Full Script', type: 'text', content: resultText }];
            }
            else if (step.agentRole === 'DescriptionAgent') { 
                const prompt = `
                Role: YouTube SEO Specialist.
                Task: Write a video description for "${context.topic}".
                Input Script Summary: ${context.script?.substring(0, 500)}...
                Requirements: 
                1. Catchy first 2 lines.
                2. Bullet points of what is covered.
                3. Hashtags.
                Language: Arabic.
                Output Plain Text.
                `;
                const response = await generateSafe(defaultModel, prompt);
                resultText = response.text;
                job.artifacts.description = resultText;
                step.outputSummary = "SEO Description Ready";
                step.artifacts = [{ label: 'Video Description', type: 'text', content: resultText }];
            }
            else if (step.agentRole === 'VisualProducer') {
                const prompt = `
                Role: Art Director.
                Task: Create 3 image generation prompts based on this script snippet: "${context.script?.substring(0, 300)}...".
                Output JSON: { "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"] }
                `;
                const response = await generateSafe(defaultModel, prompt, { responseMimeType: 'application/json' });
                resultText = response.text;
                const prompts = JSON.parse(resultText).prompts;
                
                const mockImages = prompts.map((p, i) => ({
                    label: `Scene ${i+1}`,
                    type: 'image',
                    url: `https://placehold.co/600x400/1e293b/FFF?text=${encodeURIComponent(p.substring(0, 20))}`
                }));
                
                step.outputSummary = "Visual Prompts Created";
                step.artifacts = [
                    { label: 'Prompts JSON', type: 'json', content: resultText },
                    ...mockImages
                ];
            }
            else if (step.agentRole === 'EditorAssembler') {
                // For real execution, this would trigger video composition logic.
                // In this server-side script, we currently just mark completion or trigger a placeholder.
                // NOTE: Real FFmpeg rendering logic would go here.
                step.outputSummary = "Editor Assembler Pending (Video Gen Not Implemented Server-Side yet)";
                // We don't fail here, just pass through for now or leave pending.
                // For completeness of the "Factory", we'll just log it.
            }
            else {
                step.outputSummary = `Agent ${step.agentRole} passed (Placeholder)`;
                await new Promise(r => setTimeout(r, 1000));
            }

            const cost = 0.0001;
            step.cost = cost;
            job.totalCost = (job.totalCost || 0) + cost;

            job.logs.push({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                agent: step.agentRole,
                message: `${step.name} completed successfully.`
            });

        } catch (e) {
            throw new Error(`AI Execution Failed for ${step.agentRole}: ${e.message}`);
        }
    }
}

module.exports = { jobManager: new JobManager() };
