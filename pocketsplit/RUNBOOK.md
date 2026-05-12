# PocketSplit Operational Runbook

This document provides instructions for managing the PocketSplit service in production.

## 1. How to Start Service

### Using Docker (Recommended)
```bash
docker build -t pocketsplit .
docker run -d \
  -p 5000:5000 \
  -v pocketsplit_data:/app/data \
  --name pocketsplit-api \
  pocketsplit
```

### Locally
```bash
npm install
cd client && npm install && npm run build
cd ..
npm start
```

## 2. How to Restart Service
```bash
docker restart pocketsplit-api
```

## 3. How to Inspect Logs
```bash
docker logs -f pocketsplit-api
```

## 4. How to Verify Health
Check the `/health` endpoint:

**Local**:
```bash
curl http://localhost:5000/health
```

**Production**:
```bash
curl https://pocketsplit-five.vercel.app/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "PocketSplit API",
  "database": "connected"
}
```

## 5. Common Failure Scenarios

### SQLite DB Missing
- **Symptoms**: Health check shows `database: disconnected`.
- **Cause**: Volume mount failure or path mismatch.
- **Fix**: Check `DB_PATH` env var and volume mount in docker run command.

### Port Conflict
- **Symptoms**: Container fails to start; logs show `EADDRINUSE`.
- **Fix**: Change host port mapping (e.g., `-p 5001:5000`).

### Backend Crash
- **Symptoms**: 502/504 errors from proxy; container status `Exited`.
- **Fix**: Check `docker logs` for stack traces. Restart with `docker restart`.

## 6. Recovery Procedures

### Data Corruption
1. Stop the container.
2. Restore `pocketsplit.db` from the last known good backup in the volume.
3. Start the container.

### Failed Deployment
1. Rollback to previous Docker image tag.
2. Investigate CI/CD logs in GitHub Actions.

## 7. Deployment Checklist
- [ ] Environment variables configured in production.
- [ ] Volume mount correctly mapped for persistence.
- [ ] Port 5000 exposed and accessible.
- [ ] Health check passing.
