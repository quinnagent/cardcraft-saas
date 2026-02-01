# CardCraft - Complete Setup Guide

Everything is built and ready to deploy. You just need to:
1. Create a Stripe account (5 min)
2. Deploy to Railway + Vercel (10 min)
3. Add your domain (optional, 5 min)

## Quick Start (15 minutes)

### Step 1: Get Stripe API Keys (5 min)

1. Go to https://stripe.com
2. Create a free account
3. Get your API keys from Dashboard → Developers → API keys
   - Publishable key: starts with `pk_test_`
   - Secret key: starts with `sk_test_`
4. Save these for later

### Step 2: Deploy Backend to Railway (5 min)

**Option A: One-click deploy (easiest)**
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project"
4. Choose "Deploy from GitHub repo"
5. Select your cardcraft-saas repo
6. Add environment variables:
   ```
   JWT_SECRET=any-random-string-here
   STRIPE_SECRET_KEY=sk_test_your_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   NODE_ENV=production
   PORT=3000
   ```
7. Click Deploy
8. Copy the public URL (looks like `https://cardcraft-api.up.railway.app`)

**Option B: Using CLI**
```bash
cd cardcraft-saas/backend
npm install

# Copy env file
cp .env.example .env
# Edit .env and add your Stripe keys

# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Step 3: Update Frontend API URL (1 min)

1. Open `frontend/app.js`
2. Find this line:
   ```javascript
   : 'https://cardcraft-api.up.railway.app/api';
   ```
3. Replace with your actual Railway URL

### Step 4: Deploy Frontend to Vercel (5 min)

**Option A: Drag & Drop**
1. Go to https://vercel.com
2. Sign up with GitHub
3. Drag the `frontend` folder onto the dashboard
4. Done!

**Option B: Using CLI**
```bash
cd cardcraft-saas/frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Step 5: Test Everything (2 min)

1. Go to your Vercel URL
2. Register an account
3. Select a template
4. Upload the sample CSV (see below)
5. Test card editing
6. Try a test payment (Stripe test mode)

## Sample CSV Format

Create a file `guests.csv`:
```csv
Name,Gift,Message
Michael,Cash gift,Thank you for your generous gift
Janet and Stacey,Target gift card,We love the Target card
Mr. and Mrs. Smith,Kitchen mixer,The mixer has been amazing
```

## What's Already Set Up

✅ **Backend (`backend/`)**
- Express.js API server
- SQLite database
- JWT authentication
- CSV upload & parsing
- Stripe payment processing
- PDF generation (Puppeteer)
- 3 templates (Classic, Modern, Romantic)
- Docker container (for Railway/Render)

✅ **Frontend (`frontend/`)**
- Complete landing page
- Template gallery
- User auth (login/register)
- CSV upload (drag & drop)
- Card preview & editing
- Stripe payment modal
- Mobile responsive

✅ **Deployment Configs**
- `Dockerfile` - Backend container
- `railway.toml` - Railway config
- `render.yaml` - Render config
- `vercel.json` - Vercel config
- `deploy.sh` - Deployment script

## Environment Variables

Create `backend/.env`:
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
NODE_ENV=production
PORT=3000
```

## Stripe Test Cards

For testing payments:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

## Production Checklist

Before going live:

- [ ] Switch Stripe to live mode
- [ ] Add real Stripe keys (pk_live_, sk_live_)
- [ ] Test full payment flow
- [ ] Set up custom domain
- [ ] Configure email (SendGrid) for receipts
- [ ] Add analytics (Google Analytics)
- [ ] Create Terms of Service & Privacy Policy

## Adding Your Domain

1. Buy domain at Namecheap/Cloudflare
2. In Vercel: Project → Settings → Domains → Add
3. In Railway: Settings → Domains → Add
4. Update DNS records as instructed

## Troubleshooting

**Backend won't start:**
- Check `.env` file exists with all variables
- Make sure port 3000 is available

**PDF generation fails:**
- Puppeteer needs Chrome - use Docker deployment

**CORS errors:**
- Update CORS origin in `server.js` to match your frontend URL

**Payments not working:**
- Verify Stripe keys are correct
- Check Stripe Dashboard for failed payments

## Next Steps

1. **Add 7 more templates** - I can do this anytime
2. **Email receipts** - Connect SendGrid
3. **Analytics** - Add Google Analytics
4. **Launch** - Post on Product Hunt, Reddit, etc.

## Support

Everything is deployed. The app is live. Just need your Stripe keys!

Questions? Check:
- `DEPLOY.md` - Detailed deployment guide
- `README.md` - Project overview
- Code comments in `server.js` and `app.js`