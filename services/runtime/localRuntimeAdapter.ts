
import { RuntimeAdapter } from './runtimeAdapter';
import { ExecutionResult, RuntimeSnapshot } from '../../types';

const VFS_KEY = 'av_vfs'; // Virtual File System Key
const SNAP_KEY = 'av_snapshots'; // Snapshots Key

/**
 * LocalRuntimeAdapter
 * Simulates a server environment within the browser's LocalStorage.
 * Mimics file operations, basic commands, and git-like snapshots.
 */
class LocalRuntimeAdapter implements RuntimeAdapter {
    
    constructor() {
        this.initVFS();
    }

    private initVFS() {
        if (!localStorage.getItem(VFS_KEY)) {
            // Seed initial config files
            const initialFiles = {
                'config.json': JSON.stringify({ version: '1.0.0', env: 'production' }, null, 2),
                'pipeline_rules.json': JSON.stringify({ max_retries: 3, strict_mode: true }, null, 2),
                'logs/system.log': `[${new Date().toISOString()}] System Booted\n`,
            };
            localStorage.setItem(VFS_KEY, JSON.stringify(initialFiles));
        }
        if (!localStorage.getItem(SNAP_KEY)) {
            localStorage.setItem(SNAP_KEY, JSON.stringify([]));
        }
    }

    private getVFS(): Record<string, string> {
        return JSON.parse(localStorage.getItem(VFS_KEY) || '{}');
    }

    private saveVFS(vfs: Record<string, string>) {
        localStorage.setItem(VFS_KEY, JSON.stringify(vfs));
    }

    // --- File Ops ---

    async readFile(path: string): Promise<string> {
        await new Promise(r => setTimeout(r, 100)); // Simulate IO latency
        const vfs = this.getVFS();
        if (vfs[path] === undefined) throw new Error(`File not found: ${path}`);
        return vfs[path];
    }

    async writeFile(path: string, content: string): Promise<void> {
        await new Promise(r => setTimeout(r, 200));
        const vfs = this.getVFS();
        vfs[path] = content;
        this.saveVFS(vfs);
        console.log(`[Runtime] Wrote file: ${path}`);
    }

    async listFiles(dir: string): Promise<string[]> {
        const vfs = this.getVFS();
        return Object.keys(vfs).filter(k => k.startsWith(dir));
    }

    async deleteFile(path: string): Promise<void> {
        const vfs = this.getVFS();
        delete vfs[path];
        this.saveVFS(vfs);
    }

    // --- Command Execution (Simulation) ---

    async runCmd(cmd: string, args: string[], opts?: { cwd?: string; timeout?: number }): Promise<ExecutionResult> {
        await new Promise(r => setTimeout(r, 1500)); // Simulate processing time
        
        const fullCmd = `${cmd} ${args.join(' ')}`;
        console.log(`[Runtime] Executing: ${fullCmd}`);

        // Simulate behavior based on command
        if (cmd === 'npm' && args.includes('build')) {
            return {
                success: true,
                stdout: '> build\n> tsc && vite build\n\nBuild completed successfully.',
                stderr: '',
                exitCode: 0
            };
        }

        if (cmd === 'npm' && args.includes('lint')) {
            // Randomly fail linting for demo purposes if specific file exists
            const vfs = this.getVFS();
            if (vfs['force_fail.txt']) {
                return {
                    success: false,
                    stdout: '',
                    stderr: 'Lint Error: Unexpected token in src/App.tsx',
                    exitCode: 1
                };
            }
            return { success: true, stdout: 'No lint errors found.', stderr: '', exitCode: 0 };
        }

        if (cmd === 'git' && args.includes('status')) {
            return { success: true, stdout: 'On branch main\nYour branch is up to date.', stderr: '', exitCode: 0 };
        }

        // Default echo
        return {
            success: true,
            stdout: `Executed: ${fullCmd}`,
            stderr: '',
            exitCode: 0
        };
    }

    // --- System Control ---

    async restartService(serviceName: string): Promise<void> {
        console.log(`[Runtime] Restarting service: ${serviceName}...`);
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[Runtime] Service ${serviceName} is active.`);
    }

    async getSystemLogs(lines: number = 50): Promise<string[]> {
        const vfs = this.getVFS();
        const logs = vfs['logs/system.log'] || '';
        return logs.split('\n').slice(-lines);
    }

    // --- Snapshots ---

    async createSnapshot(label: string): Promise<string> {
        const snapshots: RuntimeSnapshot[] = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
        const vfs = this.getVFS();
        
        const id = `snap_${Date.now()}`;
        const newSnap: RuntimeSnapshot & { data: any } = {
            id,
            label,
            timestamp: new Date().toISOString(),
            filesCount: Object.keys(vfs).length,
            data: vfs // Store full state
        };

        // We store the data in a separate key in real life to avoid massive LS, but here we bundle it or use a separate store.
        // For simplicity in this demo, we'll store it in a separate LS key per snapshot to avoid hitting quota too fast on the main list.
        localStorage.setItem(`snap_data_${id}`, JSON.stringify(vfs));
        
        // Remove heavy data from the list entry
        const { data, ...meta } = newSnap;
        snapshots.push(meta);
        localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots));

        console.log(`[Runtime] Snapshot created: ${label} (${id})`);
        return id;
    }

    async rollbackSnapshot(snapshotId: string): Promise<void> {
        const snapData = localStorage.getItem(`snap_data_${snapshotId}`);
        if (!snapData) throw new Error(`Snapshot data not found for ID: ${snapshotId}`);
        
        const vfs = JSON.parse(snapData);
        this.saveVFS(vfs);
        console.log(`[Runtime] System rolled back to snapshot: ${snapshotId}`);
    }

    async listSnapshots(): Promise<RuntimeSnapshot[]> {
        return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
    }
}

export const localRuntime = new LocalRuntimeAdapter();
