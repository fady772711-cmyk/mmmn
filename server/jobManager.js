
const fs = require('fs');
const path = require('path');
const { metricsService } = require('./metrics');

// Simple file-based persistence
const DB_FILE = path.join(__dirname, 'jobs.db.json');
const STORAGE_DIR = path.join(__dirname, 'storage');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

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

    // --- NEW: Trigger Batch based on Automation Plan ---
    async triggerDailyBatch() {
        // ... (Keep existing logic)
        return [];
    }

    async enqueueJob(type, payload) {
        const jobId = `job_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        
        // Define default steps (FULL 9-STEP PIPELINE) matching the Visual Design
        let steps = payload.steps;
        if (!steps || steps.length === 0) {
            steps = [
                { id: 's1', agentRole: 'StrategyDirector', name: 'Strategy .1', status: 'PENDING' },
                { id: 's2', agentRole: 'TitleGenerator', name: 'Title Gen .2', status: 'PENDING' },
                { id: 's3', agentRole: 'TitleSelector', name: 'Title Select .3', status: 'PENDING' },
                { id: 's4', agentRole: 'StructureAgent', name: 'Structure .4', status: 'PENDING' },
                { id: 's5', agentRole: 'ScriptBuilder', name: 'Scripting .5', status: 'PENDING' },
                { id: 's6', agentRole: 'VisualProducer', name: 'Visuals .6', status: 'PENDING' },
                { id: 's7', agentRole: 'VoiceDirector', name: 'Voice .7', status: 'PENDING' },
                { id: 's8', agentRole: 'MusicDirector', name: 'Music & Mix .8', status: 'PENDING' }, 
                { id: 's9', agentRole: 'EditorAssembler', name: 'Assembly .9', status: 'PENDING' }
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
            artifacts: {},
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
                job.currentStepIndex = i;
                step.status = 'RUNNING';
                this.saveJobs();

                await this.executeStep(job, step);

                step.status = 'COMPLETED';
                job.progress = Math.round(((i + 1) / job.steps.length) * 100);
                this.saveJobs();
            }

            job.status = 'COMPLETED';
            job.finishedAt = new Date().toISOString();
            metricsService.recordJobEvent(job.type, 'SUCCESS', (new Date() - new Date(job.startedAt)));

        } catch (e) {
            console.error(e);
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

    async executeStep(job, step) {
        // Reduced delay for demo speed
        const delay = 2000; 
        await new Promise(resolve => setTimeout(resolve, delay));

        const tokens = Math.floor(Math.random() * 1500) + 200;
        const cost = (tokens / 1000000) * 0.30; 
        
        step.tokenUsage = { prompt: Math.floor(tokens * 0.8), candidates: Math.floor(tokens * 0.2), total: tokens };
        step.cost = cost;
        job.totalCost = (job.totalCost || 0) + cost;
        job.totalTokens = (job.totalTokens || 0) + tokens;

        step.artifacts = [];
        step.outputSummary = '';

        // --- MOCK LOGIC FOR DEMO ---
        if (step.agentRole === 'StrategyDirector') {
            step.outputSummary = 'Generated Viral Topic';
            step.artifacts.push({ label: 'Topic', type: 'text', content: job.title });
        } 
        else if (step.agentRole === 'TitleGenerator') {
            step.outputSummary = 'Generated Variations';
            step.artifacts.push({ label: 'Variations', type: 'text', content: '1. ' + job.title + ' | Official\n2. The Truth About ' + job.title });
        }
        else if (step.agentRole === 'TitleSelector') {
            step.outputSummary = 'Optimization Complete';
            step.artifacts.push({ label: 'Selected Title / Hook', type: 'text', content: '🔴 حقيقة ' + job.title + ' التي يخفونها عنك!' });
        }
        else if (step.agentRole === 'StructureAgent') {
            step.outputSummary = 'Structure Defined';
            step.artifacts.push({ label: 'Structure', type: 'text', content: '4 Scenes x 5 Seconds' });
        }
        else if (step.agentRole === 'ScriptBuilder') {
            step.outputSummary = 'Script Generated';
            const richScript = `[مشهد 1 - الافتتاحية]
هل تعلم أن المستقبل الذي نخشاه قد بدأ بالفعل؟
(مؤثرات صوتية: تشويق)

[مشهد 2 - التفاصيل]
في عالم تتسارع فيه التكنولوجيا، لم يعد هناك مكان للاختباء من الحقيقة الرقمية.
(مؤثرات: صوت داتا)

[مشهد 3 - الذروة]
الذكاء الاصطناعي ليس مجرد أداة، إنه الشريك الجديد في كتابة التاريخ.

[مشهد 4 - الخاتمة]
اشترك الآن لتعرف المزيد عن عالم الغد.`;
            step.artifacts.push({ label: 'Script', type: 'text', content: richScript });
        }
        else if (step.agentRole === 'VisualProducer') {
            step.outputSummary = '4 Visual Scenes Generated';
            // Produce 4 distinct scenes for assembly
            const scenes = [
                { scene_id: '1', duration_seconds: 5, visual_prompt: 'Futuristic City', generatedImageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80', narration_text: 'المستقبل بدأ بالفعل.' },
                { scene_id: '2', duration_seconds: 5, visual_prompt: 'AI Robot', generatedImageUrl: 'https://images.unsplash.com/photo-1535378437323-95288ac8e65e?w=800&q=80', narration_text: 'التكنولوجيا تتسارع بلا توقف.' },
                { scene_id: '3', duration_seconds: 5, visual_prompt: 'Data Network', generatedImageUrl: 'https://images.unsplash.com/photo-1558494949-ef526b0042a0?w=800&q=80', narration_text: 'البيانات هي النفط الجديد.' },
                { scene_id: '4', duration_seconds: 5, visual_prompt: 'Space View', generatedImageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80', narration_text: 'تابعنا للمزيد.' }
            ];
            
            // Push ALL images so UI can show them in a grid
            scenes.forEach((s, i) => {
                step.artifacts.push({ label: `Scene ${i+1}`, type: 'image', url: s.generatedImageUrl });
            });
            // Push JSON for Assembler
            step.artifacts.push({ label: 'Scene List (JSON)', type: 'json', content: JSON.stringify(scenes) });
        }
        else if (step.agentRole === 'VoiceDirector') {
            step.outputSummary = 'Voiceover Ready';
            const mockVoiceUrl = "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars3.wav"; 
            step.artifacts.push({ label: 'Voice Track', type: 'audio', url: mockVoiceUrl });
        }
        else if (step.agentRole === 'MusicDirector') {
            step.outputSummary = 'Music Selected & Mixed';
            const mockMusicUrl = "https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther60.wav";
            step.artifacts.push({ 
                label: 'Audio Engineering Report', 
                type: 'mix_config', 
                content: JSON.stringify({
                    track: "Epic Sci-Fi Build",
                    trackUrl: mockMusicUrl,
                    bpm: 120,
                    mood: "Cinematic",
                    mix: { ducking: "ON (-15dB)", eq: "Voice Boost", master_gain: "-2.0dB" }
                }) 
            });
        }
        else if (step.agentRole === 'EditorAssembler') {
            step.outputSummary = 'Ready for Rendering';
            step.artifacts.push({ label: 'Assembly Manifest', type: 'text', content: 'Ready for client-side rendering.' });
        }

        job.logs.push({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            agent: step.agentRole,
            message: `${step.name} finished.`
        });
    }
}

module.exports = { jobManager: new JobManager() };
