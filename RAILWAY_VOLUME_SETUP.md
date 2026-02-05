# Railway Volume Setup for SQLite Persistence

## Problem
SQLite database is lost when Railway container restarts because it's stored in the ephemeral filesystem.

## Solution
Mount a persistent volume at `/app/data` to store the SQLite database.

## Setup Steps

1. **Create Volume in Railway Dashboard:**
   - Go to https://railway.app
   - Select your CardCraft project
   - Click "New" → "Volume"
   - Mount path: `/app/data`
   - Size: 1GB (more than enough)

2. **Set Environment Variable:**
   In Railway dashboard, add:
   ```
   RAILWAY_VOLUME_MOUNT_PATH = /app/data
   ```

3. **Deploy:**
   The code will automatically:
   - Use `/app/data/cardcraft.db` instead of local file
   - Create the directory if it doesn't exist
   - Seed all 1300+ wedding planner codes from CSV on startup

## How It Works

- Database now persists across container restarts
- On first deploy (or if CSV changes), all 1300 codes are seeded
- Subsequent restarts skip existing codes (INSERT OR IGNORE)
- COLLINREFERRAL is always ensured to exist

## Backup

To backup the database:
```bash
railway download /app/data/cardcraft.db ./backup-$(date +%Y%m%d).db
```

## Restore

To restore from backup:
```bash
railway upload ./backup-20260205.db /app/data/cardcraft.db
```
