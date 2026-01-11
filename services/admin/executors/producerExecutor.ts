
import { localRuntime } from '../../runtime/localRuntimeAdapter';
import { AgentStandardInput, AgentStandardResponse } from '../../../types';
import { server } from '../../serverOrchestrator'; // Interfacing with existing pipeline

export const executeProducer = async (input: AgentStandardInput): Promise<AgentStandardResponse> => {
    const logs: string[] = [];
    logs.push("Producer Executor Started.");

    try {
        // 1. Update Configs via Runtime Adapter if needed
        if (input.inputData.configOverrides) {
            await localRuntime.writeFile('pipeline_rules.json', JSON.stringify(input.inputData.configOverrides, null, 2));
            logs.push("Updated pipeline configuration.");
        }

        // 2. Trigger Production Job via Server Orchestrator
        logs.push(`Starting production job: ${input.inputData.topic}`);
        
        const jobId = await server.startJob({
            title: input.inputData.topic,
            type: input.inputData.type || 'Shorts',
            // Default step config for admin triggers
            stepControl: { title: 'agent', script: 'agent', scenes: 'agent', visuals: 'agent', voice: 'agent', music: 'auto', publish: 'manual' },
            visualConfig: { mode: 'images', provider: 'nano_banana', fallback: 'images', quality: 'standard', aspectRatio: '16:9' },
            durationConfig: { mode: 'fixed', unit: 'minutes', target_value: 1 }
        });

        return {
            status: 'SUCCESS',
            output: { jobId, message: "Production pipeline triggered." },
            notes: logs,
            warnings: []
        };

    } catch (e: any) {
        return {
            status: 'FAILURE',
            output: null,
            notes: logs,
            warnings: [e.message]
        };
    }
};
