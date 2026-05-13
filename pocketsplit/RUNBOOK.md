# 📓 PocketSplit Operational Runbook

> **Target Service**: PocketSplit Expense Tracker  
> **Infrastructure**: Containerized (Docker) / Cloud Hosted  
> **Criticality**: Medium (Financial Data)

---

## 🚀 1. Deployment Procedures

### How to deploy a new version
1. **Commit to Main**: Any push to the `main` branch triggers the GitHub Action.
2. **CI Pipeline**: The pipeline lints, tests, and builds a new Docker image.
3. **Registry**: The image is pushed to `ghcr.io/yourusername/pocketsplit:latest`.
4. **Auto-Deploy**: If using Render/Railway, enable "Auto-deploy from Image" or update the tag manually.

### How to rollback
If a deployment causes issues:
1. Identify the previous stable image tag in GitHub Packages (e.g., `ghcr.io/...:sha-12345`).
2. Update your hosting provider (Render/Railway) to point to the specific stable tag instead of `latest`.
3. Revert the problematic commit in Git: `git revert HEAD && git push`.

---

## 🚨 2. Incident Response (The 2 AM Drill)

### Scenario: Service is DOWN (5xx errors or Connection Refused)
1. **Check Health Endpoint**: Visit `https://your-app.com/api/health`.
2. **Check Logs**:
   - Run `docker logs <container_id>` or view Logs tab in Render/Railway.
   - Look for `Error: SQL_PARSE_ERROR` or `Turso connection failed`.
3. **Database Check**: Visit the Turso Dashboard. Check if the database is "Over quota" or "Down".
4. **Environment Variables**: Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` haven't expired.

### Scenario: High Latency
1. Check the Turso region. Ensure it matches your server region (e.g., both in `aws-ap-south-1`).
2. Check for long-running queries in the dashboard.

---

## 🛠 3. Maintenance

### Manual Seeding
To reset or re-seed the demo data:
1. Connect to the container.
2. Run `node server/db/seed.js`.
*(Note: The app auto-seeds on first run if the database is empty).*

### Database Backups
Turso handles point-in-time recovery, but you can export data via:
```bash
turso db shell pocker-split-param ".dump" > backup.sql
```

---

## 📞 4. Contacts
- **Primary Engineer**: @param3118
- **DB Provider**: Turso (https://turso.tech)
- **CI/CD**: GitHub Actions
