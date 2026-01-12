
const fs = require('fs');
const path = require('path');

const METRICS_FILE = path.join(__dirname, 'metrics.db.json');

class MetricsService {
    constructor() {
        this.data = this.loadMetrics();
    }

    loadMetrics() {
        if (!fs.existsSync(METRICS_FILE)) {
            return {
                agents: {},
                lines: {
                    'Shorts': { total: 0, success: 0, fail: 0, avgTime: 0 },
                    'Long': { total: 0, success: 0, fail: 0, avgTime: 0 }
                },
                system: { health: 'GREEN', alerts: [] }
            };
        }
        return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }

    saveMetrics() {
        fs.writeFileSync(METRICS_FILE, JSON.stringify(this.data, null, 2));
    }

    recordJobEvent(type, event, durationMs = 0) {
        if (!this.data.lines[type]) {
            this.data.lines[type] = { total: 0, success: 0, fail: 0, avgTime: 0 };
        }
        
        const line = this.data.lines[type];
        
        if (event === 'ENQUEUED') {
            line.total++;
        } else if (event === 'SUCCESS') {
            line.success++;
            // Update rolling average
            if (line.avgTime === 0) line.avgTime = durationMs;
            else line.avgTime = (line.avgTime + durationMs) / 2;
        } else if (event === 'FAILURE') {
            line.fail++;
        }

        this.analyzeHealth();
        this.saveMetrics();
    }

    analyzeHealth() {
        const failures = Object.values(this.data.lines).reduce((acc, l) => acc + l.fail, 0);
        const total = Object.values(this.data.lines).reduce((acc, l) => acc + l.total, 0);
        
        const failRate = total > 0 ? (failures / total) * 100 : 0;
        
        this.data.system.alerts = [];
        if (failRate > 20) {
            this.data.system.health = 'RED';
            this.data.system.alerts.push('Critical: System Failure Rate > 20%');
        } else if (failRate > 5) {
            this.data.system.health = 'YELLOW';
            this.data.system.alerts.push('Warning: Elevated Error Rate');
        } else {
            this.data.system.health = 'GREEN';
        }
    }

    async getAllMetrics() {
        return this.data;
    }
}

module.exports = { metricsService: new MetricsService() };
