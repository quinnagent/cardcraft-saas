# GitHub Actions Setup for CardCraft

## Automatic Deployment Workflows

### 1. Frontend Auto-Deployment (GitHub Pages)

Create `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to GitHub Pages

on:
  push:
    branches: [ main ]
    paths:
      - 'frontend/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './frontend'
      - uses: actions/deploy-pages@v4
        id: deployment
```

### 2. Backend Auto-Deployment (Railway)

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Railway

on:
  push:
    branches: [ main ]
    paths:
      - 'backend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        run: |
          npm i -g @railway/cli
          railway up --service cardcraft-api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        working-directory: ./backend
```

**Setup:**
1. Go to Railway dashboard → Account → Tokens
2. Create token and copy it
3. Go to GitHub repo → Settings → Secrets → Actions
4. Add secret: `RAILWAY_TOKEN` with your token
5. Push any change to trigger deployment

## Current Status

✅ Frontend: Deployed to https://quinnagent.github.io/cardcraft-saas/
⏳ Backend: Waiting for Railway setup
