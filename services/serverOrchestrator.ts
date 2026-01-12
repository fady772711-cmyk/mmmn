
import { ProductionJob, AutomationConfig, AdminScope } from '../types';

const API_BASE = '/api'; // Relative path, handled by Nginx or Vite Proxy

/**
 * ServerOrchestrator (Client Side Adapter)
 * Delegates ALL logic to the backend API.
 * Throws error if any attempt to execute locally is made.
 */
class ServerOrchestrator {
    
    async startJob(jobConfig: Partial<ProductionJob>): Promise<string> {
        console.log("[Orchestrator] Enqueuing job to Server:", jobConfig.title);
        
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
    }

    async triggerDailySchedule(): Promise<string[]> {
        // In this strict mode, client cannot trigger schedule logic directly, 
        // it must ask server endpoint to do it.
        const response = await fetch(`${API_BASE}/smoke/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'full_schedule_trigger' })
        });
        const data = await response.json();
        return [data.jobId];
    }

    // --- ADMIN AGENT ENTRY POINT ---

    async runAdminAgent(brief: string, scopes: AdminScope[], priority: 'Normal' | 'High'): Promise<string> {
        // Enqueue an Admin type job
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
    }

    async getAdminJobStatus(jobId: string) {
        // Poll API
        const response = await fetch(`${API_BASE}/jobs/${jobId}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    }
}

export const server = new ServerOrchestrator();
