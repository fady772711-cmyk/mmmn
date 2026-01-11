
import { DecisionLogEntry, AdminJob } from '../types';
import { db } from './storageService';

/**
 * DecisionsLog
 * The memory of the AdminDirector. It records every fork in the road.
 */
class DecisionsLogService {
    
    private logs: Record<string, DecisionLogEntry[]> = {};

    /**
     * Log a decision made by the AdminDirector
     */
    async log(jobId: string, entry: DecisionLogEntry) {
        if (!this.logs[jobId]) {
            this.logs[jobId] = [];
        }
        
        // Add to local memory
        this.logs[jobId].push(entry);

        // Persist to DB (AdminJob)
        const job = await db.getAdminJob(jobId);
        if (job) {
            // Ensure structuredDecisions array exists
            if (!job.structuredDecisions) job.structuredDecisions = [];
            job.structuredDecisions.push(entry);
            
            // Also append to the legacy string log for UI compatibility
            job.decisionsLog.push(`[${entry.phase}] ${entry.decision} - ${entry.reasoning}`);
            
            await db.saveAdminJob(job);
        }
    }

    async getLogs(jobId: string): Promise<DecisionLogEntry[]> {
        return this.logs[jobId] || [];
    }
}

export const decisionsLog = new DecisionsLogService();
