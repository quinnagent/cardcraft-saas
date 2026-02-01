require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize Stripe
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key_here');

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://cardcraft.vercel.app', 'https://your-domain.com'] 
    : ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const upload = multer({ dest: 'uploads/' });

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Templates
const templates = {
  classic: {
    name: 'Classic Elegance',
    styles: `
      .card { background: #fefefe; border: 1px solid #c9b8a8; padding: 40px; }
      .header { font-family: 'Playfair Display', serif; font-size: 38px; color: #5c4a3d; text-align: center; margin-bottom: 20px; }
      .recipient { font-family: 'Cormorant Garamond', serif; font-size: 16px; color: #4a3f35; text-align: center; margin-bottom: 15px; font-weight: 500; }
      .message { font-family: 'Cormorant Garamond', serif; font-size: 13px; line-height: 1.8; color: #3d3d3d; text-align: justify; }
      .signature { text-align: center; margin-top: 25px; }
      .signature-text { font-family: 'Cormorant Garamond', serif; font-size: 12px; color: #6b5a4a; font-style: italic; }
      .names { font-family: 'Playfair Display', serif; font-size: 24px; color: #5c4a3d; margin-top: 5px; }
    `
  },
  modern: {
    name: 'Modern Minimal',
    styles: `
      .card { background: #ffffff; border: 2px solid #e5e5e5; padding: 40px; }
      .header { font-family: 'Inter', sans-serif; font-size: 28px; color: #2d2d2d; text-align: center; margin-bottom: 20px; letter-spacing: 3px; text-transform: uppercase; }
      .recipient { font-family: 'Inter', sans-serif; font-size: 14px; color: #5a5a5a; text-align: center; margin-bottom: 15px; letter-spacing: 1px; text-transform: uppercase; }
      .message { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.8; color: #3d3d3d; text-align: justify; }
      .signature { text-align: center; margin-top: 25px; }
      .signature-text { font-family: 'Inter', sans-serif; font-size: 11px; color: #7a7a7a; letter-spacing: 0.5px; }
      .names { font-family: 'Playfair Display', serif; font-size: 26px; color: #4a4a4a; margin-top: 5px; }
    `
  },
  romantic: {
    name: 'Romantic Blush',
    styles: `
      .card { background: linear-gradient(180deg, #fff5f2 0%, #f9eae5 100%); border: 1px solid #e8d4cc; padding: 40px; }
      .header { font-family: 'Playfair Display', serif; font-size: 38px; color: #c9a89a; text-align: center; margin-bottom: 20px; font-style: italic; }
      .recipient { font-family: 'Cormorant Garamond', serif; font-size: 16px; color: #8b6b5a; text-align: center; margin-bottom: 15px; }
      .message { font-family: 'Cormorant Garamond', serif; font-size: 13px; line-height: 1.8; color: #5c4a3d; text-align: justify; }
      .signature { text-align: center; margin-top: 25px; }
      .signature-text { font-family: 'Cormorant Garamond', serif; font-size: 12px; color: #a89080; font-style: italic; }
      .names { font-family: 'Playfair Display', serif; font-size: 24px; color: #c9a89a; margin-top: 5px; }
    `
  }
};

// Routes

// Auth
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  
  db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function(err) {
    if (err) return res.status(400).json({ error: 'Email exists' });
    const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET);
    res.json({ token, user: { id: this.lastID, email } });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email } });
  });
});

// Projects
app.post('/api/projects', authenticate, (req, res) => {
  const { template } = req.body;
  
  db.run('INSERT INTO projects (user_id, template) VALUES (?, ?)', [req.user.id, template], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, template, status: 'draft' });
  });
});

app.get('/api/projects', authenticate, (req, res) => {
  db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// CSV Upload
app.post('/api/projects/:id/upload', authenticate, upload.single('file'), (req, res) => {
  const projectId = req.params.id;
  const cards = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      cards.push({
        project_id: projectId,
        recipient_name: row.Name || row.name,
        gift: row.Gift || row.gift,
        message: row.Message || row.message || generateDefaultMessage(row.Gift || row.gift)
      });
    })
    .on('end', () => {
      const stmt = db.prepare('INSERT INTO cards (project_id, recipient_name, gift, message) VALUES (?, ?, ?, ?)');
      cards.forEach(card => stmt.run(card.project_id, card.recipient_name, card.gift, card.message));
      stmt.finalize();
      
      fs.unlinkSync(req.file.path);
      res.json({ count: cards.length });
    });
});

function generateDefaultMessage(gift) {
  return `Thank you so much for your generous gift${gift ? ` of ${gift}` : ''}. Your kindness means the world to us as we begin this new chapter together.`;
}

// Get cards - preview only 4 if not paid
app.get('/api/projects/:id/cards', authenticate, (req, res) => {
  const { preview } = req.query;
  
  db.get('SELECT payment_status FROM projects WHERE id = ?', [req.params.id], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // If preview mode and not paid, only return 4 cards
    const limit = (preview === 'true' && project.payment_status !== 'paid') ? 4 : 999;
    
    db.all('SELECT * FROM cards WHERE project_id = ? ORDER BY sort_order LIMIT ?', 
      [req.params.id, limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        cards: rows,
        total: rows.length,
        isPreview: preview === 'true' && project.payment_status !== 'paid',
        isPaid: project.payment_status === 'paid'
      });
    });
  });
});

// Get all cards count (for upgrade prompt)
app.get('/api/projects/:id/cards/count', authenticate, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM cards WHERE project_id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row.count });
  });
});

// Update card
app.put('/api/cards/:id', authenticate, (req, res) => {
  const { message } = req.body;
  db.run('UPDATE cards SET message = ? WHERE id = ?', [message, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Stripe payment
app.post('/api/create-payment', authenticate, async (req, res) => {
  const { projectId, plan } = req.body;
  
  const prices = { starter: 1900, premium: 3900, unlimited: 7900 };
  const amount = prices[plan];
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { projectId, userId: req.user.id }
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm payment and generate PDF
app.post('/api/confirm-payment', authenticate, async (req, res) => {
  const { projectId, paymentIntentId } = req.body;
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      db.run('UPDATE projects SET payment_status = ?, payment_id = ? WHERE id = ?', 
        ['paid', paymentIntentId, projectId]);
      
      const pdfUrl = await generatePDF(projectId);
      res.json({ success: true, pdfUrl });
    } else {
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF
async function generatePDF(projectId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM projects WHERE id = ?', [projectId], async (err, project) => {
      if (err || !project) return reject(err);
      
      db.all('SELECT * FROM cards WHERE project_id = ?', [projectId], async (err, cards) => {
        if (err) return reject(err);
        
        const template = templates[project.template] || templates.classic;
        const pdfPath = path.join(__dirname, 'pdfs', `project-${projectId}.pdf`);
        
        if (!fs.existsSync(path.join(__dirname, 'pdfs'))) {
          fs.mkdirSync(path.join(__dirname, 'pdfs'));
        }
        
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        let htmlContent = `
          <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
            <style>
              @page { size: letter; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Cormorant Garamond', serif; }
              .sheet { width: 8.5in; height: 11in; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0; padding: 0; page-break-after: always; }
              .card { width: 4.25in; height: 5.5in; display: flex; flex-direction: column; justify-content: center; padding: 0.4in; position: relative; }
              ${template.styles}
            </style>
          </head>
          <body>
        `;
        
        // Group cards into sheets of 4
        for (let i = 0; i < cards.length; i += 4) {
          htmlContent += '<div class="sheet">';
          for (let j = i; j < i + 4 && j < cards.length; j++) {
            const card = cards[j];
            htmlContent += `
              <div class="card">
                <div class="header">Thank You</div>
                <div class="recipient">Dear ${card.recipient_name},</div>
                <div class="message">${card.message}</div>
                <div class="signature">
                  <div class="signature-text">With appreciation,</div>
                  <div class="names">Collin and Annika</div>
                </div>
              </div>
            `;
          }
          // Fill empty slots
          for (let j = cards.length; j < i + 4; j++) {
            htmlContent += '<div class="card"></div>';
          }
          htmlContent += '</div>';
        }
        
        htmlContent += '</body></html>';
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'letter', printBackground: true });
        await browser.close();
        
        resolve(`/pdfs/project-${projectId}.pdf`);
      });
    });
  });
}

// Download PDF - requires payment
app.get('/api/download/:projectId', authenticate, (req, res) => {
  const projectId = req.params.projectId;
  
  // Check if paid
  db.get('SELECT payment_status FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (project.payment_status !== 'paid') {
      return res.status(403).json({ error: 'Payment required' });
    }
    
    const pdfPath = path.join(__dirname, 'pdfs', `project-${projectId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath);
    } else {
      res.status(404).json({ error: 'PDF not found' });
    }
  });
});

// Get templates
app.get('/api/templates', (req, res) => {
  res.json(templates);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve PDFs statically
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

app.listen(PORT, () => {
  console.log(`🎨 CardCraft API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});