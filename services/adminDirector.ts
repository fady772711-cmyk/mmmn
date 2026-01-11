

import { AdminJob, AgentRole, AgentStandardInput, JobStatus, DecisionLogEntry } from '../types';
import { db } from './storageService';
import { commandBus } from './commandBus';
import { decisionsLog } from './decisionsLog';

/**
 * AdminDirector
 * The Central Commander.
 * It orchestrates the entire factory. No one else makes decisions.
 */
class AdminDirector {

    /**
     * Entry Point: Receive User Command
     */
    async executeMission(jobId: string) {
        const job = await db.getAdminJob(jobId);
        if (!job) return;

        try {
            await this.updateStatus(jobId, 'EXECUTING');
            
            // 1. Analyze Phase (Understand Intent)
            await this.logDecision(jobId, 'Analysis', 'Parsing Brief', 'Starting deep analysis of user brief', ['Standard protocol']);
            
            // Determine Production Pipeline based on Brief
            // In a real AI implementation, we'd ask an LLM here. For now, we use deterministic logic based on keywords.
            const isShorts = job.brief.toLowerCase().includes('short');
            const topic = this.extractTopic(job.brief);
            
            await this.logDecision(jobId, 'Planning', `Determined Pipeline: ${isShorts ? 'Shorts' : 'Long Form'}`, `Keyword analysis of brief. Topic: ${topic}`, ['Other formats']);

            // 2. Execution Phase (The Unbreakable Chain)
            
            const context: any = {
                topic,
                isShorts,
                channelId: 'ch_1', // Defaulting to first channel for admin demo
                rawBrief: job.brief
            };

            // Step A: Script (The Foundation)
            context.script = await this.runAgentStep(jobId, AgentRole.SCRIPT_BUILDER, 'Write Script', { topic, isShorts }, context);
            if (!context.script) throw new Error("Script generation failed. Aborting chain.");

            // Step B: Voice (The Narrator)
            context.voice = await this.runAgentStep(jobId, AgentRole.VOICE_DIRECTOR, 'Generate Voiceover', { script: context.script }, context);

            // Step C: Visuals (The Eyes)
            context.visuals = await this.runAgentStep(jobId, AgentRole.VISUAL_PRODUCER, 'Create Visuals', { script: context.script, style: 'Cinematic' }, context);

            // Step D: Music (The Soul)
            context.music = await this.runAgentStep(jobId, AgentRole.MUSIC_DIRECTOR, 'Select Music', { mood: 'Dramatic' }, context);

            // Step E: Assembly (The Final Product)
            const finalVideo = await this.runAgentStep(jobId, AgentRole.EDITOR_ASSEMBLER, 'Assemble Video', { ...context }, context);

            // Step F: QC (The Gatekeeper)
            const qcResult = await this.runAgentStep(jobId, AgentRole.QA_REVIEWER, 'Quality Check', { video: finalVideo }, context);
            
            if (qcResult && qcResult.status === 'FAIL') {
                throw new Error(`QC Failed: ${qcResult.reason}`);
            }

            // Step G: Risk Assessment
            await this.runAgentStep(jobId, AgentRole.RISK_AGENT, 'Content Safety Check', { script: context.script }, context);

            // Success
            await this.finishJob(jobId, finalVideo);

        } catch (e: any) {
            await this.failJob(jobId, e.message);
        }
    }

    // --- Helper: Run Single Agent via Bus ---
    private async runAgentStep(jobId: string, role: AgentRole, objective: string, inputData: any, context: any): Promise<any> {
        
        await this.logDecision(jobId, 'Execution', `Invoking ${role}`, `Objective: ${objective}`, []);

        const packet: AgentStandardInput = {
            taskId: `${jobId}_${role}_${Date.now()}`,
            role: role,
            objective: objective,
            inputData: inputData,
            context: context,
            meta: {
                fromAdminDirector: true, // THE SEAL
                timestamp: new Date().toISOString(),
                priority: 'Normal'
            }
        };

        const response = await commandBus.dispatch(packet);

        if (response.status === 'SUCCESS') {
            await this.logDecision(jobId, 'Result', `${role} Completed`, 'Output received and validated.', []);
            return response.output;
        } else {
            // Simple Retry Logic (1 Attempt)
            console.warn(`[AdminDirector] ${role} failed. Retrying once...`);
            await this.logDecision(jobId, 'Retry', `${role} Failed`, `Reason: ${response.warnings.join(', ')}. Retrying...`, []);
            
            const retryResponse = await commandBus.dispatch(packet);
            if (retryResponse.status === 'SUCCESS') {
                return retryResponse.output;
            }
            
            throw new Error(`${role} Failed after retry: ${retryResponse.warnings.join(' | ')}`);
        }
    }

    private extractTopic(brief: string): string {
        const match = brief.match(/about (.+?)(?:\.|,|$)/i);
        return match ? match[1] : "General Topic";
    }

    private async logDecision(jobId: string, phase: string, decision: string, reasoning: string, rejected: string[]) {
        await decisionsLog.log(jobId, {
            timestamp: new Date().toISOString(),
            phase, decision, request: '', reasoning, rejectedAlternatives: rejected
        });
    }

    private async updateStatus(jobId: string, status: any) {
        const job = await db.getAdminJob(jobId);
        if (job) {
            job.status = status;
            await db.saveAdminJob(job);
        }
    }

    private async finishJob(jobId: string, output: any) {
        const job = await db.getAdminJob(jobId);
        if (job) {
            job.status = 'COMPLETED';
            job.finalOutput = {
                summary: 'Production Chain Completed Successfully.',
                videoUrl: output?.videoUrl,
                timestamp: new Date().toISOString()
            };
            await db.saveAdminJob(job);
        }
    }

    private async failJob(jobId: string, error: string) {
        const job = await db.getAdminJob(jobId);
        if (job) {
            job.status = 'FAILED';
            job.finalOutput = { error };
            await decisionsLog.log(jobId, {
                timestamp: new Date().toISOString(),
                phase: 'Termination',
                decision: 'Abort Mission',
                reasoning: error,
                request: ''
            });
            await db.saveAdminJob(job);
        }
    }
}

export const adminDirector = new AdminDirector();