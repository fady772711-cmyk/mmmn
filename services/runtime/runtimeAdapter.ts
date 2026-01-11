
import { ExecutionResult, RuntimeSnapshot } from '../../types';

/**
 * RuntimeAdapter Interface
 * Defines the contract for the execution environment.
 * This allows us to swap between a Local (Simulated in Browser) adapter 
 * and a Docker (Remote) adapter seamlessly.
 */
export interface RuntimeAdapter {
    // --- File Operations ---
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(dir: string): Promise<string[]>;
    deleteFile(path: string): Promise<void>;

    // --- Command Execution ---
    /**
     * Executes a shell command.
     * In Browser mode: Simulates success/failure for known commands (e.g., 'npm run build').
     * In Docker mode: Actually runs the command in the container.
     */
    runCmd(cmd: string, args: string[], opts?: { cwd?: string; timeout?: number }): Promise<ExecutionResult>;

    // --- System Control ---
    restartService(serviceName: string): Promise<void>;
    getSystemLogs(lines?: number): Promise<string[]>;

    // --- Snapshots (Git-like) ---
    /**
     * Creates a checkpoint of the current file system / state.
     */
    createSnapshot(label: string): Promise<string>; // Returns snapshot ID

    /**
     * Reverts the system to a previous checkpoint.
     */
    rollbackSnapshot(snapshotId: string): Promise<void>;

    /**
     * Lists available snapshots.
     */
    listSnapshots(): Promise<RuntimeSnapshot[]>;
}
