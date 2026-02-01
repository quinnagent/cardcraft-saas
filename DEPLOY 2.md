# CardCraft - Full SaaS Deployment Guide

## Project Structure
```
cardcraft-saas/
├── backend/
│   ├── server.js          # Express API server
│   ├── database.js        # SQLite database setup
│   ├── package.json       # Node dependencies
│   └── .env.example       # Environment variables template
├── frontend/
│   ├── index.html         # Main landing page
│   └── app.js             # Frontend JavaScript
└── DEPLOY.md              # This file
```

## Local Development

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env with your Stripe keys
```

### 3. Run Backend
```bash
npm run dev
```

### 4. Serve Frontend
```bash
cd ../frontend
python3 -m http.server 8080
```

## Production Deployment

### Backend Deployment (Railway/Render)

1. **Railway**
   - Create account at railway.app
   - New project → Deploy from GitHub repo
   - Add environment variables in Railway dashboard
   - Deploy automatically

2. **Render**
   - Create account at render.com
   - New Web Service → Connect GitHub
   - Build command: `npm install`
   - Start command: `node server.js`
   - Add environment variables
   - Deploy

### Frontend Deployment (Vercel/Netlify)

1. **Vercel**
   - Install CLI: `npm i -g vercel`
   - Run: `vercel --prod`
   - Or connect GitHub repo

2. **Netlify**
   - Drag and drop frontend folder
   - Or connect GitHub repo

### Database
SQLite is used by default. For production:
- Option 1: Keep SQLite (works fine for this scale)
- Option 2: Switch to PostgreSQL on Railway/Supabase

### Stripe Setup

1. Create account at stripe.com
2. Get API keys from Dashboard
3. Add webhook endpoint: `https://your-api.com/webhook`
4. Update environment variables

### Domain Setup

1. Buy domain (Namecheap, Cloudflare, etc.)
2. Point DNS to Vercel/Netlify for frontend
3. Point API subdomain to Railway/Render backend
4. Update CORS in backend to allow your domain

## Features Implemented

- [x] User authentication (JWT)
- [x] Project management
- [x] CSV upload
- [x] Card editing
- [x] 3 templates (classic, modern, romantic)
- [x] Stripe payments
- [x] PDF generation with Puppeteer
- [x] Download PDF

## Future Enhancements

- [ ] 7 more templates
- [ ] Email delivery of PDFs
- [ ] Preview before payment
- [ ] Bulk message editing
- [ ] Save/load projects
- [ ] Analytics dashboard
- [ ] Affiliate program
- [ ] Template marketplace

## Revenue Model

- Starter: $19 (25 cards)
- Premium: $39 (100 cards)
- Unlimited: $79 (unlimited)

With 100 customers/month at $39 average:
- Revenue: $3,900/month
- Stripe fees: ~$117 (3%)
- Hosting: ~$20/month
- Net profit: ~$3,760/month

## Marketing Channels

1. SEO: "wedding thank you card template"
2. Pinterest: Visual pins of templates
3. Instagram: Wedding content
4. Reddit: r/weddingplanning
5. Product Hunt launch
6. Etsy alternative positioning
7. Facebook/Instagram ads
8. Wedding vendor partnerships

## Support

For issues or questions:
- Email: support@cardcraft.com
- GitHub Issues
- Documentation: docs.cardcraft.com