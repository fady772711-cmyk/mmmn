
import { AgentRole } from '../../types';

interface PolicyCheck {
    allowed: boolean;
    reason?: string;
}

/**
 * PolicyEngine
 * Enforces the "Ask-First" and "Admin-Only" protocols.
 */
class PolicyEngine {
    
    private auditLog: string[] = [];

    /**
     * Check if an agent is authorized to perform an action.
     * Strict Rule: Only Executors dispatched by ADMIN can perform Runtime Ops.
     */
    checkPermission(requestingAgent: AgentRole, actionType: string): PolicyCheck {
        
        // Admin has full control
        if (requestingAgent === AgentRole.ADMIN_PLANNER) {
            this.log(requestingAgent, actionType, true);
            return { allowed: true };
        }

        // Executors need explicit task context (mocked here as always allowed if valid role)
        // In a real system, we'd check if they have an active Token from the Admin.
        const allowedExecutors = [
            AgentRole.BUILDER_EXECUTOR,
            AgentRole.FIXER_EXECUTOR,
            AgentRole.PRODUCER_EXECUTOR
        ];

        if (allowedExecutors.includes(requestingAgent)) {
            this.log(requestingAgent, actionType, true);
            return { allowed: true };
        }

        this.log(requestingAgent, actionType, false, "Unauthorized Agent Role");
        return { allowed: false, reason: "Unauthorized Agent Role" };
    }

    private log(agent: string, action: string, allowed: boolean, reason?: string) {
        const entry = `[${new Date().toISOString()}] ${agent} -> ${action} | ${allowed ? 'ALLOWED' : 'DENIED'} ${reason ? `(${reason})` : ''}`;
        this.auditLog.push(entry);
        console.log(`[PolicyEngine] ${entry}`);
    }

    getAuditLog() {
        return this.auditLog;
    }
}

export const policyEngine = new PolicyEngine();
