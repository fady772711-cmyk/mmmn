
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os'); // Import OS module
const { jobManager } = require('./jobManager');
const { metricsService } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- API ROUTES ---

// 1. Jobs Endpoint
app.post('/api/jobs/enqueue', async (req, res) => {
    try {
        const { type, payload } = req.body;
        const jobId = await jobManager.enqueueJob(type, payload);
        res.json({ success: true, jobId, message: 'Job enqueued successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/jobs', async (req, res) => {
    const jobs = await jobManager.getAllJobs();
    res.json(jobs);
});

app.get('/api/jobs/:id', async (req, res) => {
    const job = await jobManager.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// 2. Metrics & KPI Endpoint
app.get('/api/metrics', async (req, res) => {
    const data = await metricsService.getAllMetrics();
    res.json(data);
});

// UPGRADED HEALTH ENDPOINT
app.get('/api/health', (req, res) => {
    // Memory Calculation
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    // CPU Calculation (Load Avg)
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg()[0]; // 1 minute load average
    // Rough estimate of percentage based on load avg vs cores
    let cpuUsage = Math.round((loadAvg / cpuCount) * 100);
    if (cpuUsage > 100) cpuUsage = 100;

    res.json({ 
        status: 'green', 
        uptime: process.uptime(),
        workers: 1,
        mode: 'production_server_only',
        system: {
            cpu: cpuUsage,
            ram: memUsage,
            totalMemGb: (totalMem / 1024 / 1024 / 1024).toFixed(1),
            platform: os.platform()
        }
    });
});

// 3. Artifacts Serving (Range Support for Video/Audio)
app.get('/api/artifacts/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'storage', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

    // Determine Content-Type
    const ext = path.extname(req.params.filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.mp3') contentType = 'audio/mpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// 4. Smoke Test / Trigger Endpoint
app.post('/api/smoke/run', async (req, res) => {
    const mode = req.body.mode;
    
    if (mode === 'daily_batch') {
        const jobIds = await jobManager.triggerDailyBatch();
        return res.json({ success: true, jobIds, note: 'Daily Batch of 5 videos triggered.' });
    }

    const jobId = await jobManager.enqueueJob('smoke_test', { mode: mode || 'short' });
    res.json({ success: true, jobId, note: 'Smoke test started' });
});

// --- Frontend Static Serving ---
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`[VideoFactory] Server running on port ${PORT}`);
    console.log(`[Mode] SERVER-ONLY EXECUTION ENFORCED`);
});
