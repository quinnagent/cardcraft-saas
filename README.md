# CardCraft - Wedding Thank You Card SaaS

A complete full-stack application for generating personalized wedding thank you cards.

## What's Built

### Backend (`/backend`)
- **Express.js API** with full CRUD operations
- **SQLite database** for users, projects, and cards
- **JWT authentication** with bcrypt password hashing
- **CSV upload** with drag-and-drop support
- **Stripe payment** integration (Starter/Premium/Unlimited tiers)
- **PDF generation** using Puppeteer (4-up layout)
- **3 templates**: Classic, Modern, Romantic (easily extensible)

### Frontend (`/frontend`)
- **Landing page** with template gallery
- **User authentication** (login/register modal)
- **Project workflow**: Select template → Upload CSV → Edit cards → Pay → Download
- **Live card preview** with navigation
- **Stripe payment** modal
- **Responsive design** with modern CSS

## Quick Start

```bash
# 1. Setup backend
cd backend
cp .env.example .env
# Edit .env with your Stripe keys
npm install
npm run dev

# 2. In another terminal, serve frontend
cd frontend
python3 -m http.server 8080

# 3. Open http://localhost:8080
```

## File Structure

```
cardcraft-saas/
├── backend/
│   ├── server.js          # Main Express server (400+ lines)
│   ├── database.js        # SQLite setup
│   ├── package.json       # Dependencies
│   └── .env.example       # Environment template
├── frontend/
│   ├── index.html         # Complete landing page
│   └── app.js             # Frontend logic (300+ lines)
├── DEPLOY.md              # Deployment instructions
└── README.md              # This file
```

## Key Features

1. **Template System**: CSS-only designs, no images needed
2. **CSV Upload**: Simple format - Name, Gift, Message
3. **PDF Generation**: Print-ready 4-up layout (8.5x11)
4. **Payment Tiers**: $19 / $39 / $79 one-time
5. **Card Editing**: Edit each message before generating

## Deployment

See `DEPLOY.md` for full instructions:
1. Backend: Railway or Render
2. Frontend: Vercel or Netlify
3. Database: SQLite (included) or PostgreSQL
4. Payments: Stripe account

## Business Potential

- **Market**: 2.3M weddings/year in US
- **Target**: Couples 3-6 months post-wedding
- **Revenue**: $39 avg × 100 customers/month = $3,900/month
- **Margins**: 90%+ (digital product)
- **Competition**: Minted ($$$), Canva (overwhelming), Etsy (varied quality)

## Next Steps

1. Get Stripe keys and test payments
2. Deploy backend to Railway
3. Deploy frontend to Vercel
4. Add 7 more templates
5. Launch on Product Hunt
6. Run Facebook/Instagram ads

## Tech Stack

- **Backend**: Node.js, Express, SQLite, Puppeteer, Stripe
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Auth**: JWT tokens
- **PDF**: Puppeteer (headless Chrome)
- **Payments**: Stripe Elements

## Credits

Built for Collin & Annika's wedding thank you cards, turned into a SaaS product.