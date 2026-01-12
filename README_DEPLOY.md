
# AutoVideo Factory - Server-Only Production Deployment

## Requirements
- Node.js 18+
- Nginx (Recommended)
- PM2 (Installed automatically by deploy script)

## Quick Start
1. Add `.env` file in root with `API_KEY=...` (Gemini).
2. Run:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Server Structure
- **Frontend**: Served via Express from `dist/`.
- **API**: `/api/jobs`, `/api/metrics`, `/api/artifacts`.
- **Storage**: Artifacts stored in `server/storage/`.

## Smoke Test
Verify system is running:
```bash
curl http://localhost:3000/api/health
```
Trigger a test job:
```bash
curl -X POST http://localhost:3000/api/smoke/run
```
