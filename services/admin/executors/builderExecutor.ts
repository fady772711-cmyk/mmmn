
import { localRuntime } from '../../runtime/localRuntimeAdapter';
import { AgentStandardInput, AgentStandardResponse } from '../../../types';

export const executeBuilder = async (input: AgentStandardInput): Promise<AgentStandardResponse> => {
    const logs: string[] = [];
    logs.push("Builder Executor Started.");

    try {
        // 1. Snapshot before changes
        const snapId = await localRuntime.createSnapshot("pre_build_" + Date.now());
        logs.push(`Snapshot created: ${snapId}`);

        // 2. Apply Changes (If any provided in input)
        if (input.inputData.files) {
            for (const file of input.inputData.files) {
                await localRuntime.writeFile(file.path, file.content);
                logs.push(`Updated file: ${file.path}`);
            }
        }

        // 3. Run Build/Lint
        logs.push("Running Lint check...");
        const lintRes = await localRuntime.runCmd('npm', ['run', 'lint']);
        if (!lintRes.success) {
            throw new Error(`Lint failed: ${lintRes.stderr}`);
        }

        logs.push("Running Build...");
        const buildRes = await localRuntime.runCmd('npm', ['run', 'build']);
        if (!buildRes.success) {
            throw new Error(`Build failed: ${buildRes.stderr}`);
        }

        return {
            status: 'SUCCESS',
            output: { message: "Build successful", snapshotId: snapId },
            notes: logs,
            warnings: []
        };

    } catch (e: any) {
        logs.push(`ERROR: ${e.message}`);
        logs.push("Initiating Rollback...");
        
        // Automatic Rollback
        // In a real scenario, we'd store the snapId better. 
        // For now, we assume the last snapshot is the one we made.
        const snaps = await localRuntime.listSnapshots();
        if (snaps.length > 0) {
            const lastSnap = snaps[snaps.length - 1];
            await localRuntime.rollbackSnapshot(lastSnap.id);
            logs.push(`Rolled back to ${lastSnap.id}`);
        }

        return {
            status: 'FAILURE',
            output: null,
            notes: logs,
            warnings: [e.message]
        };
    }
};
