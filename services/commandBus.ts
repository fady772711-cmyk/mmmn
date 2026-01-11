
import { AgentRegistry } from './agentRegistry';
import { AgentStandardInput, AgentStandardResponse, AgentRole, AgentMetrics } from '../types';
import { db } from './storageService';

/**
 * CommandBus
 * The ONLY secure way to reach an Agent.
 * It enforces the "Golden Rule": No agent execution without AdminDirector signature.
 * NOW INCLUDES: Mandatory KPI & Health Monitoring.
 */
class CommandBus {

    /**
     * Dispatch a command to a specific agent.
     * @param packet The strictly typed input packet
     */
    async dispatch(packet: AgentStandardInput): Promise<AgentStandardResponse> {
        
        // 1. Security Check: The Seal of Approval
        if (!packet.meta || packet.meta.fromAdminDirector !== true) {
            console.error(`[CommandBus] Security Violation! Unauthorized attempt to call ${packet.role}`);
            return {
                status: 'FAILURE',
                output: null,
                notes: [],
                warnings: ['Unauthorized Execution Attempt. Protocol requires AdminDirector signature.']
            };
        }

        // 2. Agent Resolution
        const agent = AgentRegistry[packet.role];
        if (!agent) {
            return {
                status: 'FAILURE',
                output: null,
                notes: [],
                warnings: [`Agent role '${packet.role}' not found in Registry.`]
            };
        }

        // Check if agent is suspended
        const metrics = await db.getAgentMetrics();
        const existingMetric = metrics.find(m => m.role === packet.role);
        if (existingMetric && existingMetric.status === 'SUSPENDED') {
             return {
                status: 'FAILURE',
                output: null,
                notes: [],
                warnings: [`Agent ${packet.role} is SUSPENDED due to high failure rate. Contact Admin.`]
            };
        }

        console.log(`[CommandBus] Dispatching Task ${packet.taskId} to ${packet.role}...`);
        
        // --- KPI START ---
        const startTime = Date.now();

        try {
            // 3. Execute
            const result = await agent.execute(packet);
            
            // --- KPI END & UPDATE ---
            const duration = Date.now() - startTime;
            await this.updateMetrics(packet.role, duration, result.status === 'SUCCESS');

            // 4. Return Standard Response
            return result;

        } catch (e: any) {
            // --- KPI FAILURE ---
            const duration = Date.now() - startTime;
            await this.updateMetrics(packet.role, duration, false);

            console.error(`[CommandBus] Agent ${packet.role} Crashed:`, e);
            return {
                status: 'FAILURE',
                output: null,
                notes: [],
                warnings: [`Critical Exception: ${e.message}`]
            };
        }
    }

    private async updateMetrics(role: AgentRole, duration: number, isSuccess: boolean) {
        const metricsList = await db.getAgentMetrics();
        let metric = metricsList.find(m => m.role === role);

        if (!metric) {
            metric = {
                role: role,
                avgExecutionTime: 0,
                maxExecutionTime: 0,
                successCount: 0,
                failureCount: 0,
                failureRate: 0,
                qualityScore: 100, // Start perfect
                humanInterventionCount: 0,
                status: 'ACTIVE',
                lastUpdated: new Date().toISOString()
            };
        }

        // Update stats
        const totalRuns = metric.successCount + metric.failureCount + 1;
        
        // Rolling Average Time
        metric.avgExecutionTime = Math.round(((metric.avgExecutionTime * (totalRuns - 1)) + duration) / totalRuns);
        metric.maxExecutionTime = Math.max(metric.maxExecutionTime, duration);

        if (isSuccess) {
            metric.successCount++;
        } else {
            metric.failureCount++;
        }

        // Update Failure Rate
        metric.failureRate = parseFloat(((metric.failureCount / totalRuns) * 100).toFixed(2));

        // Auto-Action Logic (Strict Rule Enforcement)
        if (metric.failureRate > 20 && totalRuns > 5) {
            metric.status = 'SUSPENDED';
            // Note: AdminDirector will pick this up in its health check loop
        } else if (metric.failureRate > 10) {
            metric.status = 'DEGRADED';
        } else {
            metric.status = 'ACTIVE';
        }

        metric.lastUpdated = new Date().toISOString();
        await db.saveAgentMetric(metric);
    }
}

export const commandBus = new CommandBus();
