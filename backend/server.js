require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer-core');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize Stripe
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key_here');

// Initialize Email (using Gmail SMTP or SendGrid)
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// LLM Integration with OpenRouter
async function generateMessageWithAI(guest, tone) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const prompt = `Write a ${tone} wedding thank you note to ${guest.name} who gave a ${guest.gift}. Keep it 2-3 sentences, warm and personal.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://cardcraft.app',
      'X-Title': 'CardCraft'
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that writes personalized wedding thank you notes.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenRouter API error:', errorData);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// CORS configuration - allow all origins for now
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
  const { template, cardsPerPage } = req.body;
  
  db.run('INSERT INTO projects (user_id, template, cards_per_page) VALUES (?, ?, ?)', 
    [req.user.id, template, cardsPerPage || 4], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, template, cardsPerPage: cardsPerPage || 4, status: 'draft' });
  });
});

app.get('/api/projects', authenticate, (req, res) => {
  db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// CSV Upload with validation
app.post('/api/projects/:id/upload', authenticate, upload.single('file'), (req, res) => {
  const projectId = req.params.id;
  const cards = [];
  const errors = [];
  let rowCount = 0;
  
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      message: 'Please select a CSV file to upload'
    });
  }
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('headers', (headers) => {
      // Validate headers
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      const hasName = normalizedHeaders.includes('name');
      const hasGift = normalizedHeaders.includes('gift');
      const hasMessage = normalizedHeaders.includes('message');
      
      if (!hasName || !hasGift) {
        errors.push('CSV must have "Name" and "Gift" columns. Optional: "Message" column.');
      }
    })
    .on('data', (row) => {
      rowCount++;
      const name = row.Name || row.name;
      const gift = row.Gift || row.gift;
      
      if (!name || !gift) {
        errors.push(`Row ${rowCount}: Missing name or gift`);
        return;
      }
      
      cards.push({
        project_id: projectId,
        recipient_name: name,
        gift: gift,
        message: row.Message || row.message || ''
      });
    })
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      
      if (errors.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid CSV format',
          details: errors,
          message: 'Please fix the CSV format and try again'
        });
      }
      
      if (cards.length === 0) {
        return res.status(400).json({
          error: 'Empty CSV',
          message: 'No valid guest data found in the CSV file'
        });
      }
      
      const stmt = db.prepare('INSERT INTO cards (project_id, recipient_name, gift, message) VALUES (?, ?, ?, ?)');
      cards.forEach(card => stmt.run(card.project_id, card.recipient_name, card.gift, card.message));
      stmt.finalize();
      
      res.json({ count: cards.length });
    })
    .on('error', (err) => {
      fs.unlinkSync(req.file.path);
      res.status(400).json({
        error: 'CSV parse error',
        message: 'Could not read the CSV file. Make sure it is a valid CSV format.'
      });
    });
});

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

// Generate AI messages for all cards in a project
app.post('/api/projects/:id/generate-ai-messages', authenticate, async (req, res) => {
  const { tone } = req.body;
  
  db.all('SELECT * FROM cards WHERE project_id = ?', [req.params.id], async (err, cards) => {
    if (err) return res.status(500).json({ error: err.message });
    
    try {
      const updatedCards = [];
      for (const card of cards) {
        const guest = { name: card.recipient_name, gift: card.gift };
        const message = await generateMessageWithAI(guest, tone);
        
        // Update in database
        await new Promise((resolve, reject) => {
          db.run('UPDATE cards SET message = ? WHERE id = ?', [message, card.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        updatedCards.push({ id: card.id, message });
      }
      
      res.json({ success: true, cards: updatedCards });
    } catch (error) {
      console.error('AI generation failed:', error);
      res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'Failed to generate AI messages. Please try again later or write your own messages.'
      });
    }
  });
});

// Stripe payment - authenticated
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

// Simple guest checkout - no auth required
app.post('/api/create-payment-intent', async (req, res) => {
  const { plan, email, guests, template } = req.body;
  
  const prices = { starter: 1900, premium: 3900, unlimited: 7900 };
  const amount = prices[plan];
  
  if (!amount) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  try {
    // Create temporary project
    const projectId = uuidv4();
    
    // Store in temporary memory (or could use temp DB table)
    global.tempProjects = global.tempProjects || {};
    global.tempProjects[projectId] = {
      email,
      guests,
      template: template || 'classic',
      cardsPerPage: 4,
      createdAt: Date.now()
    };
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { 
        projectId,
        email,
        guestCount: guests?.length || 0
      }
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm payment and generate PDF - authenticated
app.post('/api/confirm-payment', authenticate, async (req, res) => {
  const { projectId, paymentIntentId } = req.body;
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      db.run('UPDATE projects SET payment_status = ?, payment_id = ? WHERE id = ?', 
        ['paid', paymentIntentId, projectId]);
      
      const pdfUrl = await generatePDF(projectId);
      
      // Get user email to send download link
      db.get(`SELECT u.email FROM users u 
              JOIN projects p ON u.id = p.user_id 
              WHERE p.id = ?`, [projectId], async (err, row) => {
        if (!err && row) {
          await sendDownloadEmail(row.email, projectId, pdfUrl);
        }
      });
      
      res.json({ success: true, pdfUrl });
    } else {
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple confirm payment - no auth required (guest checkout)
app.post('/api/confirm-payment-simple', async (req, res) => {
  const { paymentIntentId, email } = req.body;
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }
    
    const { projectId } = paymentIntent.metadata;
    const tempProject = global.tempProjects?.[projectId];
    
    if (!tempProject) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Generate PDF directly from temp data (no DB needed)
    const pdfPath = await generatePDFSimple(tempProject, projectId);
    const pdfUrl = `/pdfs/${path.basename(pdfPath)}`;
    
    // Send email with download link
    await sendDownloadEmail(email, projectId, pdfUrl);
    
    // Clean up temp data
    delete global.tempProjects[projectId];
    
    res.json({ success: true, pdfUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send download email
async function sendDownloadEmail(email, projectId, pdfUrl) {
  const fullUrl = `${process.env.FRONTEND_URL || 'https://quinnagent.github.io/cardcraft-saas'}${pdfUrl}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Wedding Thank You Cards Are Ready! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #5c4a3d;">Your Cards Are Ready!</h2>
        <p>Thank you for using CardCraft! Your personalized wedding thank you cards have been generated and are ready for download.</p>
        
        <div style="background: #f8f6f3; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="${fullUrl}" 
             style="background: #5c4a3d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Download Your Cards (PDF)
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          The PDF is formatted for printing on standard letter paper (8.5" x 11"). 
          We recommend using cardstock for best results.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Need help? Reply to this email or contact support.
        </p>
      </div>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`Download email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Generate PDF without database (for guest checkout)
async function generatePDFSimple(project, projectId) {
  const cards = project.guests.map(g => ({
    recipient_name: g.name,
    gift: g.gift,
    message: g.message || `Thank you for your thoughtful gift${g.gift ? ` of ${g.gift}` : ''}. Your generosity means the world to us as we begin this new chapter together.`
  }));
  
  const template = templates[project.template] || templates.classic;
  const cardsPerPage = project.cardsPerPage || 4;
  const pdfPath = path.join(__dirname, 'pdfs', `project-${projectId}.pdf`);
  
  if (!fs.existsSync(path.join(__dirname, 'pdfs'))) {
    fs.mkdirSync(path.join(__dirname, 'pdfs'));
  }
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Calculate dimensions based on cards per page
  let gridStyles, cardStyles;
  
  if (cardsPerPage === 1) {
    gridStyles = 'grid-template-columns: 1fr; grid-template-rows: 1fr;';
    cardStyles = 'width: 7in; height: 9in; padding: 0.75in;';
  } else if (cardsPerPage === 2) {
    gridStyles = 'grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: 0.5in; padding: 0.5in;';
    cardStyles = 'width: 7.5in; height: 4.5in; padding: 0.4in;';
  } else {
    gridStyles = 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0; padding: 0;';
    cardStyles = 'width: 4.25in; height: 5.5in; padding: 0.4in;';
  }
  
  let htmlContent = `
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        @page { size: letter; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cormorant Garamond', serif; }
        .sheet { width: 8.5in; height: 11in; display: grid; ${gridStyles} page-break-after: always; }
        .card { display: flex; flex-direction: column; justify-content: center; position: relative; ${cardStyles} }
        ${template.styles}
      </style>
    </head>
    <body>
  `;
  
  for (let i = 0; i < cards.length; i += cardsPerPage) {
    htmlContent += '<div class="sheet">';
    for (let j = i; j < i + cardsPerPage && j < cards.length; j++) {
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
    for (let j = cards.length; j < i + cardsPerPage; j++) {
      htmlContent += '<div class="card"></div>';
    }
    htmlContent += '</div>';
  }
  
  htmlContent += '</body></html>';
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  await page.pdf({ path: pdfPath, format: 'letter', printBackground: true });
  await browser.close();
  
  return pdfPath;
}

// Generate PDF with configurable cards per page
async function generatePDF(projectId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM projects WHERE id = ?', [projectId], async (err, project) => {
      if (err || !project) return reject(err);
      
      db.all('SELECT * FROM cards WHERE project_id = ?', [projectId], async (err, cards) => {
        if (err) return reject(err);
        
        const template = templates[project.template] || templates.classic;
        const cardsPerPage = project.cards_per_page || 4;
        const pdfPath = path.join(__dirname, 'pdfs', `project-${projectId}.pdf`);
        
        if (!fs.existsSync(path.join(__dirname, 'pdfs'))) {
          fs.mkdirSync(path.join(__dirname, 'pdfs'));
        }
        
        const browser = await puppeteer.launch({
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Calculate dimensions based on cards per page
        let gridStyles, cardStyles;
        
        if (cardsPerPage === 1) {
          // 1 card per page - full page size
          gridStyles = 'grid-template-columns: 1fr; grid-template-rows: 1fr;';
          cardStyles = 'width: 7in; height: 9in; padding: 0.75in;';
        } else if (cardsPerPage === 2) {
          // 2 cards per page - side by side or stacked
          gridStyles = 'grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: 0.5in; padding: 0.5in;';
          cardStyles = 'width: 7.5in; height: 4.5in; padding: 0.4in;';
        } else {
          // 4 cards per page (default) - 2x2 grid
          gridStyles = 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0; padding: 0;';
          cardStyles = 'width: 4.25in; height: 5.5in; padding: 0.4in;';
        }
        
        // Adjust font sizes based on card size
        let fontSizeStyles = '';
        if (cardsPerPage === 1) {
          fontSizeStyles = `
            .header { font-size: 56px !important; margin-bottom: 30px !important; }
            .recipient { font-size: 20px !important; margin-bottom: 25px !important; }
            .message { font-size: 16px !important; line-height: 2 !important; }
            .signature-text { font-size: 14px !important; }
            .names { font-size: 36px !important; margin-top: 10px !important; }
          `;
        } else if (cardsPerPage === 2) {
          fontSizeStyles = `
            .header { font-size: 42px !important; margin-bottom: 20px !important; }
            .recipient { font-size: 16px !important; margin-bottom: 15px !important; }
            .message { font-size: 13px !important; line-height: 1.8 !important; }
            .signature-text { font-size: 11px !important; }
            .names { font-size: 28px !important; }
          `;
        }
        
        let htmlContent = `
          <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
            <style>
              @page { size: letter; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Cormorant Garamond', serif; }
              .sheet { width: 8.5in; height: 11in; display: grid; ${gridStyles} page-break-after: always; }
              .card { display: flex; flex-direction: column; justify-content: center; position: relative; ${cardStyles} }
              ${template.styles}
              ${fontSizeStyles}
            </style>
          </head>
          <body>
        `;
        
        // Group cards into sheets
        for (let i = 0; i < cards.length; i += cardsPerPage) {
          htmlContent += '<div class="sheet">';
          for (let j = i; j < i + cardsPerPage && j < cards.length; j++) {
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
          for (let j = cards.length; j < i + cardsPerPage; j++) {
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