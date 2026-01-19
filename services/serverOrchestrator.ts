
import { ProductionJob, AutomationConfig, AdminScope, JobStatus } from '../types';
import { db } from './storageService';

const API_BASE = '/api'; // Relative path, handled by Nginx or Vite Proxy

/**
 * ServerOrchestrator (Client Side Adapter)
 * Delegates logic to the backend API, but falls back to Client-Side simulation if server is down.
 */
class ServerOrchestrator {
    
    async startJob(jobConfig: Partial<ProductionJob>): Promise<string> {
        console.log("[Orchestrator] Enqueuing job:", jobConfig.title);
        
        try {
            const response = await fetch(`${API_BASE}/jobs/enqueue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: jobConfig.type || 'Long',
                    payload: jobConfig
                })
            });

            if (!response.ok) {
                throw new Error(`Server Refused Job: ${response.statusText}`);
            }

            const data = await response.json();
            return data.jobId;
        } catch (e) {
            console.warn("[Orchestrator] Server unreachable, falling back to Local Simulation (Client Mode).", e);
            return this.createLocalJob(jobConfig);
        }
    }

    async triggerDailySchedule(): Promise<string[]> {
        try {
            const response = await fetch(`${API_BASE}/smoke/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'full_schedule_trigger' })
            });
            const data = await response.json();
            return [data.jobId];
        } catch (e) {
            console.warn("[Orchestrator] Server unreachable, skipping schedule trigger.");
            return [];
        }
    }

    async triggerSmokeTest(): Promise<string> {
        try {
            const response = await fetch(`${API_BASE}/smoke/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'simulation' })
            });
            const data = await response.json();
            return data.jobId;
        } catch (e) {
            console.warn("[Orchestrator] Server unreachable, creating local smoke test.");
            return this.createLocalJob({ 
                title: 'Local Smoke Test', 
                type: 'smoke_test', 
                triggerType: 'Manual',
                channelId: 'ch_1',
                durationConfig: { mode: 'fixed', unit: 'minutes', target_value: 1 }
            } as any);
        }
    }

    async runAdminAgent(brief: string, scopes: AdminScope[], priority: 'Normal' | 'High'): Promise<string> {
        try {
            const response = await fetch(`${API_BASE}/jobs/enqueue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'AdminTask',
                    payload: { brief, scopes, priority }
                })
            });
            const data = await response.json();
            return data.jobId;
        } catch (e) {
            console.warn("[Orchestrator] Server unreachable, cannot run Admin Agent remotely.");
            throw new Error("Admin Agent requires server connection.");
        }
    }

    async getAdminJobStatus(jobId: string) {
        try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    // --- CLIENT-SIDE FALLBACK LOGIC ---
    
    private async createLocalJob(payload: Partial<ProductionJob>): Promise<string> {
        const jobId = `job_local_${Date.now()}`;
        
        const steps = [
            { id: 's1', agentRole: 'StrategyDirector' as any, name: 'Strategy', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's2', agentRole: 'ScriptBuilder' as any, name: 'Scripting', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's3', agentRole: 'VisualProducer' as any, name: 'Visuals', status: JobStatus.PENDING, retryCount: 0 },
            { id: 's4', agentRole: 'EditorAssembler' as any, name: 'Assembly', status: JobStatus.PENDING, retryCount: 0 }
        ];

        const job: ProductionJob = {
            id: jobId,
            runId: 'run_local',
            title: payload.title || 'Untitled Local Job',
            type: payload.type as any || 'Long',
            currentStepIndex: 0,
            status: JobStatus.RUNNING, // Start immediately
            steps: steps,
            artifacts: {},
            logs: [{ timestamp: new Date().toISOString(), level: 'INFO', agent: 'System' as any, message: 'Job started locally (Offline Mode)' }],
            createdAt: new Date().toISOString(),
            progress: 0,
            ...payload
        };

        await db.saveJob(job);
        
        // Simulate Async Execution (Mock)
        this.simulateLocalExecution(jobId);

        return jobId;
    }

    private async simulateLocalExecution(jobId: string) {
        // Simple mock loop to update status for demo purposes
        // In a real PWA, this would be a Web Worker
        setTimeout(async () => {
            const jobs = await db.getJobs();
            const job = jobs.find(j => j.id === jobId);
            if (!job) return;

            // 1. Strategy
            job.steps[0].status = JobStatus.COMPLETED;
            job.currentStepIndex = 1;
            job.progress = 25;
            job.logs.push({ timestamp: new Date().toISOString(), level: 'INFO', agent: 'StrategyDirector' as any, message: 'Strategy defined (Mock)' });
            await db.saveJob(job);

            setTimeout(async () => {
                // 2. Script
                job.steps[1].status = JobStatus.COMPLETED;
                job.currentStepIndex = 2;
                job.progress = 50;
                await db.saveJob(job);
                
                setTimeout(async () => {
                    // 3. Visuals
                    job.steps[2].status = JobStatus.COMPLETED;
                    job.currentStepIndex = 3;
                    job.progress = 75;
                    await db.saveJob(job);

                    setTimeout(async () => {
                        // 4. Finish
                        job.steps[3].status = JobStatus.COMPLETED;
                        job.status = JobStatus.COMPLETED;
                        job.progress = 100;
                        await db.saveJob(job);
                    }, 2000);
                }, 2000);
            }, 2000);
        }, 1000);
    }
}

export const server = new ServerOrchestrator();
