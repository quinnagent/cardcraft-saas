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

// Import fetch for Node.js (fallback to node-fetch if native fetch not available)
const fetch = global.fetch || require('node-fetch');

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

// Fallback message generator when AI fails
function generateFallbackMessage(guest, tone) {
  const gift = guest.gift || 'gift';
  const name = guest.name || 'friend';
  
  const templates = {
    warm: `Dear ${name}, thank you so much for your generous ${gift}. Your thoughtfulness means the world to us as we start our new life together. We're so grateful you could share in our special day!`,
    formal: `Dear ${name}, we extend our sincere gratitude for your generous ${gift}. Your presence at our wedding was deeply appreciated, and your gift will help us build our future together. With warm regards,`,
    casual: `Hey ${name}! Thanks a ton for the awesome ${gift}! We had such a blast at the wedding and loved having you there. Can't wait to use your gift in our new place!`,
    poetic: `Dearest ${name}, your ${gift} arrived like a gentle blessing, weaving warmth into the tapestry of our new beginning. We are forever grateful for your love and presence on our special day.`
  };
  
  return templates[tone] || templates.warm;
}

// LLM Integration with OpenRouter - Enhanced with retry logic and fallbacks

// List of models to try in order (fallback chain)
const MODEL_CHAIN = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free'
];

// Exponential backoff delay calculation
function getRetryDelay(attempt, baseDelay = 1000) {
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = delay * 0.1 * (Math.random() - 0.5); // ±5% jitter
  return Math.round(delay + jitter);
}

// Retry wrapper for async functions
async function withRetry(fn, options = {}) {
  const { maxRetries = 2, baseDelay = 1000, shouldRetry } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const statusCode = error.statusCode || error.status || 0;
      const isRetryable = [408, 429, 502, 503].includes(statusCode);
      
      // Check custom retry condition if provided
      const customRetry = shouldRetry ? shouldRetry(error) : true;
      
      if ((!isRetryable && !customRetry) || attempt === maxRetries) {
        throw error;
      }
      
      const delay = getRetryDelay(attempt, baseDelay);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Try generating with a specific model
async function tryGenerateWithModel(apiKey, model, guest, tone) {
  const prompt = `Write a ${tone} wedding thank you note to ${guest.name} who gave a ${guest.gift}. Keep it 2-3 sentences, warm and personal.`;
  
  console.log(`Trying model ${model} for:`, guest.name);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://cardcraft.app',
      'X-Title': 'CardCraft'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that writes personalized wedding thank you notes.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.8
    })
  });

  console.log(`Model ${model} response status:`, response.status);

  if (!response.ok) {
    const error = new Error(`API error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const responseText = await response.text();
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error(`Failed to parse response from ${model}:`, responseText.substring(0, 200));
    throw new Error('Invalid JSON response');
  }
  
  if (!data.choices || !data.choices[0]) {
    console.error(`No choices in response from ${model}:`, JSON.stringify(data).substring(0, 200));
    throw new Error('Invalid response structure');
  }
  
  const choice = data.choices[0];
  const content = choice.message?.content || choice.text || choice.content;
  
  if (!content) {
    console.error(`No content in response from ${model}`);
    throw new Error('No content in response');
  }
  
  console.log(`Model ${model} succeeded for:`, guest.name);
  return content.trim();
}

// Main AI generation function with model fallback chain
async function generateMessageWithAI(guest, tone) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.log('OPENROUTER_API_KEY not configured, using fallback');
    return generateFallbackMessage(guest, tone);
  }

  // Try each model in the chain
  for (const model of MODEL_CHAIN) {
    try {
      // Use retry logic for each model attempt
      const message = await withRetry(
        () => tryGenerateWithModel(OPENROUTER_API_KEY, model, guest, tone),
        { maxRetries: 1, baseDelay: 1000 }
      );
      
      if (message && message.length > 10) {
        return message;
      }
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);
      // Continue to next model
    }
  }

  // All models failed, use fallback
  console.log('All AI models failed, using fallback message for:', guest.name);
  return generateFallbackMessage(guest, tone);
}

// CORS configuration - explicitly allow GitHub Pages
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allowed origins list
    const allowedOrigins = [
      'https://quinnagent.github.io',
      'http://localhost:8080',
      'http://localhost:3000'
    ];
    
    // Check if origin is allowed (exact match or subdomain of quinnagent.github.io)
    if (allowedOrigins.includes(origin) || origin.endsWith('.quinnagent.github.io') || origin.includes('quinnagent.github.io')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
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
const templates = require('./templates');

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

// Generate AI messages - no auth required for guest checkout
// Explicit CORS headers for this endpoint to ensure it works from any frontend origin
app.options('/api/generate-ai-messages', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.post('/api/generate-ai-messages', async (req, res) => {
  // Set CORS headers explicitly for this public endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const { tone, guests } = req.body;
  
  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'No guests provided' });
  }
  
  try {
    const updatedCards = [];
    for (const guest of guests) {
      const message = await generateMessageWithAI(guest, tone);
      updatedCards.push({ 
        id: guest.id || Math.random().toString(36).substr(2, 9),
        recipient_name: guest.name,
        gift: guest.gift,
        message 
      });
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

// Pricing config with affiliate support
const PRICING = {
  starter: { basePrice: 2500, name: 'Starter Package', description: 'Up to 25 cards', discountedPrice: 1600 },
  premium: { basePrice: 5900, name: 'Premium Package', description: 'Up to 75 cards', discountedPrice: 3600 },
  unlimited: { basePrice: 9900, name: 'Unlimited Package', description: 'Unlimited cards', discountedPrice: 6000 }
};

// Validate affiliate code
app.get('/api/validate-affiliate/:code', async (req, res) => {
  const { code } = req.params;
  
  db.get('SELECT * FROM affiliate_codes WHERE code = ? AND is_active = 1', [code.toUpperCase()], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json({ valid: false });
    
    res.json({
      valid: true,
      code: row.code,
      name: row.name,
      discount: row.discount_percent,
      prices: {
        starter: PRICING.starter.discountedPrice,
        premium: PRICING.premium.discountedPrice,
        unlimited: PRICING.unlimited.discountedPrice
      }
    });
  });
});

// Stripe Checkout - creates a Checkout Session for hosted payment page
app.post('/api/create-checkout-session', async (req, res) => {
  const { plan, email, guests, template, affiliateCode } = req.body;
  
  // Check for affiliate code
  let discountedPrice = null;
  let appliedCode = null;
  
  if (affiliateCode) {
    const affiliate = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM affiliate_codes WHERE code = ? AND is_active = 1', 
        [affiliateCode.toUpperCase()], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
    }).catch(() => null);
    
    if (affiliate) {
      discountedPrice = PRICING[plan]?.discountedPrice;
      appliedCode = affiliate.code;
    }
  }
  
  const planDetails = {
    starter: { 
      amount: discountedPrice || PRICING.starter.basePrice, 
      name: 'Starter Package', 
      description: 'Up to 25 cards',
      baseAmount: PRICING.starter.basePrice
    },
    premium: { 
      amount: discountedPrice || PRICING.premium.basePrice, 
      name: 'Premium Package', 
      description: 'Up to 75 cards',
      baseAmount: PRICING.premium.basePrice
    },
    unlimited: { 
      amount: discountedPrice || PRICING.unlimited.basePrice, 
      name: 'Unlimited Package', 
      description: 'Unlimited cards',
      baseAmount: PRICING.unlimited.basePrice
    }
  };
  
  const selectedPlan = planDetails[plan];
  if (!selectedPlan) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  try {
    // Create temporary project
    const projectId = uuidv4();
    
    // Store project data
    global.tempProjects = global.tempProjects || {};
    global.tempProjects[projectId] = {
      email,
      guests,
      template: template || 'classic',
      cardsPerPage: 4,
      createdAt: Date.now(),
      plan
    };
    
    // Calculate discount and commission
    const discountAmount = appliedCode ? (selectedPlan.baseAmount - selectedPlan.amount) : 0;
    const commissionAmount = appliedCode ? Math.round(discountAmount * 0.75) : 0; // 75% of discount goes to affiliate
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `CardCraft - ${selectedPlan.name}${appliedCode ? ` (${appliedCode} Discount)` : ''}`,
            description: `${selectedPlan.description} | Template: ${template || 'classic'} | Cards: ${guests?.length || 0}`,
          },
          unit_amount: selectedPlan.amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://quinnagent.github.io/cardcraft-saas'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://quinnagent.github.io/cardcraft-saas'}/`,
      customer_email: email,
      metadata: {
        projectId,
        email,
        guestCount: guests?.length || 0,
        template: template || 'classic',
        affiliateCode: appliedCode || '',
        baseAmount: selectedPlan.baseAmount.toString(),
        discountAmount: discountAmount.toString(),
        commissionAmount: commissionAmount.toString()
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Handle successful checkout
app.get('/api/checkout-success', async (req, res) => {
  const { session_id } = req.query;
  
  console.log('Checkout success called with session:', session_id);
  
  if (!session_id) {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('Session status:', session.payment_status);
    
    if (session.payment_status === 'paid') {
      const { projectId, email, affiliateCode, baseAmount, discountAmount, commissionAmount } = session.metadata;
      console.log('Project ID:', projectId, 'Email:', email, 'Affiliate:', affiliateCode);
      
      // Track affiliate referral if applicable
      if (affiliateCode && affiliateCode !== '') {
        try {
          db.run(
            `INSERT INTO affiliate_referrals 
             (affiliate_code, customer_email, order_amount, discount_amount, commission_amount, payment_intent_id, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [affiliateCode, email, parseInt(baseAmount), parseInt(discountAmount), parseInt(commissionAmount), session.payment_intent, 'pending'],
            function(err) {
              if (err) {
                console.error('Error tracking affiliate referral:', err);
              } else {
                console.log('Affiliate referral tracked:', affiliateCode, 'Commission:', commissionAmount);
                // Update affiliate totals
                db.run(
                  `UPDATE affiliate_codes 
                   SET total_sales = total_sales + 1, 
                       total_commission = total_commission + ? 
                   WHERE code = ?`,
                  [parseInt(commissionAmount), affiliateCode]
                );
              }
            }
          );
        } catch (affErr) {
          console.error('Affiliate tracking error:', affErr);
        }
      }
      
      const tempProject = global.tempProjects?.[projectId];
      
      if (!tempProject) {
        console.error('Project not found in temp storage');
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log('Generating PDF for project...');
      // Generate PDF
      const pdfPath = await generatePDFSimple(tempProject, projectId);
      const pdfUrl = `/pdfs/${path.basename(pdfPath)}`;
      console.log('PDF generated:', pdfUrl);
      
      // Send email with download link (if configured)
      console.log('Sending email...');
      const emailSent = await sendDownloadEmail(email, projectId, pdfUrl);
      console.log('Email sent:', emailSent);
      
      // Clean up temp data
      delete global.tempProjects[projectId];
      
      res.json({ success: true, pdfUrl, emailSent });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (err) {
    console.error('Checkout success error:', err);
    res.status(500).json({ error: err.message, details: err.stack });
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
  // Check if email is configured
  console.log('Checking email config:', {
    user: process.env.EMAIL_USER ? 'Set' : 'Not set',
    pass: process.env.EMAIL_PASS ? 'Set' : 'Not set',
    service: process.env.EMAIL_SERVICE
  });
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured - skipping email send');
    return false;
  }
  
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
    console.log('Attempting to send email to:', email);
    console.log('Using SMTP service:', process.env.EMAIL_SERVICE || 'gmail');
    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:');
    console.error('  Message:', error.message);
    console.error('  Code:', error.code);
    console.error('  Command:', error.command);
    console.error('  Response:', error.response);
    return false;
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
  
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  
  // Page dimensions: 8.5 x 11 inches letter size
  // With 0.25in margins on all sides, printable area is 8 x 10.5 inches
  const pageWidth = 8; // inches
  const pageHeight = 10.5; // inches
  const margin = 0.25; // inches
  const gap = 0.15; // inches between cards
  
  let cardWidth, cardHeight, cardsAcross, cardsDown, scale;
  
  if (cardsPerPage === 1) {
    // 1 card centered on page
    cardWidth = 6;
    cardHeight = 8;
    cardsAcross = 1;
    cardsDown = 1;
  } else if (cardsPerPage === 2) {
    // 2 cards stacked vertically
    cardWidth = 7;
    cardHeight = 4.5;
    cardsAcross = 1;
    cardsDown = 2;
  } else {
    // 4 cards in 2x2 grid
    cardsAcross = 2;
    cardsDown = 2;
    // Calculate card size to fit with gaps
    cardWidth = (pageWidth - (margin * 2) - gap) / cardsAcross;
    cardHeight = (pageHeight - (margin * 2) - gap) / cardsDown;
  }
  
  // Build the page HTML using absolute positioning for precise layout
  let pagesHtml = '';
  
  for (let pageIndex = 0; pageIndex < cards.length; pageIndex += cardsPerPage) {
    let cardsHtml = '';
    
    for (let i = 0; i < cardsPerPage; i++) {
      const cardIndex = pageIndex + i;
      if (cardIndex >= cards.length) break;
      
      const card = cards[cardIndex];
      
      // Calculate position
      const col = i % cardsAcross;
      const row = Math.floor(i / cardsAcross);
      
      const left = margin + (col * (cardWidth + gap));
      const top = margin + (row * (cardHeight + gap));
      
      cardsHtml += `
        <div class="card" style="
          position: absolute;
          left: ${left}in;
          top: ${top}in;
          width: ${cardWidth}in;
          height: ${cardHeight}in;
        ">
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
    
    pagesHtml += `
      <div class="page" style="
        position: relative;
        width: ${pageWidth}in;
        height: ${pageHeight}in;
        page-break-after: always;
        overflow: hidden;
      ">
        ${cardsHtml}
      </div>
    `;
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        @page {
          size: letter;
          margin: 0.25in;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Cormorant Garamond', serif;
          margin: 0;
          padding: 0;
        }
        .card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0.3in;
          overflow: hidden;
        }
        .header {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          color: #5c4a3d;
          text-align: center;
          margin-bottom: 0.2in;
        }
        .recipient {
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px;
          color: #4a3f35;
          text-align: center;
          margin-bottom: 0.15in;
          font-weight: 500;
        }
        .message {
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px;
          line-height: 1.6;
          color: #3d3d3d;
          text-align: center;
          flex: 1;
          display: flex;
          align-items: center;
          max-width: 100%;
        }
        .signature {
          text-align: center;
          margin-top: 0.2in;
        }
        .signature-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 10px;
          color: #6b5a4a;
          font-style: italic;
        }
        .names {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          color: #5c4a3d;
          margin-top: 0.05in;
        }
        ${template.styles}
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    preferCSSPageSize: true
  });
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

// Affiliate management endpoints
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key';

const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Create affiliate code (admin only)
app.post('/api/admin/affiliates', authenticateAdmin, (req, res) => {
  const { code, name, email, payout_method, payout_email } = req.body;
  
  db.run(
    `INSERT INTO affiliate_codes (code, name, email, payout_method, payout_email) 
     VALUES (?, ?, ?, ?, ?)`,
    [code.toUpperCase(), name, email, payout_method || 'paypal', payout_email || email],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Affiliate code already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, code: code.toUpperCase(), name, email });
    }
  );
});

// Seed COLLINREFERRAL code
function seedCollinReferral() {
  db.get("SELECT * FROM affiliate_codes WHERE code = 'COLLINREFERRAL'", (err, row) => {
    if (!row) {
      db.run(
        `INSERT INTO affiliate_codes (code, name, email, payout_method, payout_email, discount_percent, commission_percent) 
         VALUES ('COLLINREFERRAL', 'Collin Referral', 'collin@example.com', 'paypal', 'collin@example.com', 40, 30)`,
        (err) => {
          if (err) console.error('Error seeding COLLINREFERRAL:', err);
          else console.log('✅ COLLINREFERRAL affiliate code created');
        }
      );
    }
  });
}

// Get all affiliates (admin only)
app.get('/api/admin/affiliates', authenticateAdmin, (req, res) => {
  db.all('SELECT * FROM affiliate_codes ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get affiliate stats
app.get('/api/admin/affiliates/:code/stats', authenticateAdmin, (req, res) => {
  const { code } = req.params;
  
  db.get('SELECT * FROM affiliate_codes WHERE code = ?', [code.toUpperCase()], (err, affiliate) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });
    
    db.all('SELECT * FROM affiliate_referrals WHERE affiliate_code = ? ORDER BY created_at DESC', 
      [code.toUpperCase()], (err, referrals) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ affiliate, referrals });
      });
  });
});

// Get pending payouts
app.get('/api/admin/affiliates/pending-payouts', authenticateAdmin, (req, res) => {
  db.all(`
    SELECT 
      ar.affiliate_code,
      ac.name,
      ac.payout_method,
      ac.payout_email,
      SUM(ar.commission_amount) as total_pending,
      COUNT(ar.id) as referral_count
    FROM affiliate_referrals ar
    JOIN affiliate_codes ac ON ar.affiliate_code = ac.code
    WHERE ar.status = 'pending'
    GROUP BY ar.affiliate_code, ac.name, ac.payout_method, ac.payout_email
    ORDER BY total_pending DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Mark referrals as paid (admin only)
app.post('/api/admin/affiliates/:code/mark-paid', authenticateAdmin, (req, res) => {
  const { code } = req.params;
  
  db.run(
    `UPDATE affiliate_referrals SET status = 'paid', paid_at = CURRENT_TIMESTAMP 
     WHERE affiliate_code = ? AND status = 'pending'`,
    [code.toUpperCase()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ markedPaid: this.changes });
    }
  );
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    openrouterConfigured: !!process.env.OPENROUTER_API_KEY
  });
});

// Test OpenRouter
app.get('/api/test-openrouter', async (req, res) => {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });
  }
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cardcraft.app',
        'X-Title': 'CardCraft'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'user', content: 'Say "OpenRouter is working"' }
        ],
        max_tokens: 50
      })
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      return res.status(500).json({ 
        error: 'OpenRouter API error', 
        status: response.status,
        response: responseText.substring(0, 500)
      });
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ 
        error: 'Invalid JSON response', 
        response: responseText.substring(0, 500)
      });
    }
    
    // Handle different response formats
    const choice = data.choices?.[0];
    const content = choice?.message?.content || choice?.text || choice?.content || 'No message';
    
    res.json({
      success: true,
      message: content,
      model: data.model,
      usage: data.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve PDFs statically
app.use('/api/pdfs', express.static(path.join(__dirname, 'pdfs')));

app.listen(PORT, () => {
  console.log(`🎨 CardCraft API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  // Seed default affiliate code
  seedCollinReferral();
});