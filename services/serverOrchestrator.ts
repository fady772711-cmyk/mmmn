
import { ProductionJob, AutomationConfig, AdminScope } from '../types';
import { db } from './storageService';
import { adminDirector } from './adminDirector';

/**
 * ServerOrchestrator
 * NOW JUST A FACADE.
 * It passes requests to the AdminDirector.
 */
class ServerOrchestrator {
    
    // Legacy support: Start Job -> Wraps it for Admin
    async startJob(jobConfig: Partial<ProductionJob>): Promise<string> {
        // We create a "Shadow Admin Job" to handle this production request
        const brief = `Production Request: ${jobConfig.title}. Type: ${jobConfig.type}`;
        return this.runAdminAgent(brief, ['Production'], 'Normal');
    }

    async triggerDailySchedule(): Promise<string[]> {
        // This would call AdminDirector's "SchedulerAgent" capability in the future
        console.log("Triggering via AdminDirector...");
        return [];
    }

    // --- ADMIN AGENT ENTRY POINT ---

    async runAdminAgent(brief: string, scopes: AdminScope[], priority: 'Normal' | 'High'): Promise<string> {
        // 1. Create the Record
        const jobId = `admin_${Date.now()}`;
        await db.saveAdminJob({
            id: jobId,
            brief,
            scopes: scopes as any, // Fix type mismatch if enum differs
            priority,
            status: 'PLANNING',
            executionPlan: [],
            decisionsLog: [],
            structuredDecisions: [],
            createdAt: new Date().toISOString()
        });

        // 2. Delegate execution to the Director (Fire & Forget)
        adminDirector.executeMission(jobId);

        return jobId;
    }

    async getAdminJobStatus(jobId: string) {
        return await db.getAdminJob(jobId);
    }
}

export const server = new ServerOrchestrator();
