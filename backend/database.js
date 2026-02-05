const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use Railway volume if available, otherwise use local directory
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'cardcraft.db');
console.log('Database path:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      payment_status TEXT DEFAULT 'pending',
      payment_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      gift TEXT,
      message TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // Affiliate codes table
  db.run(`
    CREATE TABLE IF NOT EXISTS affiliate_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      discount_percent INTEGER DEFAULT 35,
      commission_percent INTEGER DEFAULT 30,
      payout_method TEXT DEFAULT 'paypal',
      payout_email TEXT,
      total_sales INTEGER DEFAULT 0,
      total_commission INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Referral tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_code TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      order_amount INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL,
      payment_intent_id TEXT,
      status TEXT DEFAULT 'pending',
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (affiliate_code) REFERENCES affiliate_codes(code)
    )
  `);

  console.log('Database initialized');
  
  // Seed affiliate codes from CSV after a short delay
  setTimeout(() => {
    seedAffiliateCodesFromCSV();
  }, 1000);
}

// Seed affiliate codes from wedding_planners CSV
function seedAffiliateCodesFromCSV() {
  const csv = require('csv-parser');
  
  // Try multiple possible paths (local dev vs Railway Docker)
  const possiblePaths = [
    path.join(__dirname, '..', 'wedding_planners_FINAL.csv'),  // Local dev: backend/../
    path.join(__dirname, 'wedding_planners_FINAL.csv'),         // Same directory
    path.join('/app', 'wedding_planners_FINAL.csv'),            // Railway root
    path.join(process.cwd(), 'wedding_planners_FINAL.csv'),     // Working directory
    'wedding_planners_FINAL.csv'                                // Relative to cwd
  ];
  
  let csvPath = null;
  for (const p of possiblePaths) {
    console.log('Checking for CSV at:', p);
    if (fs.existsSync(p)) {
      csvPath = p;
      console.log('Found CSV at:', p);
      break;
    }
  }
  
  if (!csvPath) {
    console.log('No wedding_planners_FINAL.csv found at any location, skipping CSV seed');
    console.log('Checked paths:', possiblePaths);
    return;
  }
  
  console.log('Seeding affiliate codes from CSV...');
  
  let count = 0;
  const codes = [];
  
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.referral_code && row.company) {
        codes.push({
          code: row.referral_code.toUpperCase(),
          name: row.company,
          email: row.email || 'planner@example.com'
        });
      }
    })
    .on('end', () => {
      console.log(`Found ${codes.length} codes in CSV`);
      
      // Insert codes (use INSERT OR IGNORE to skip duplicates)
      let inserted = 0;
      let errors = 0;
      
      codes.forEach(({ code, name, email }) => {
        db.run(
          `INSERT OR IGNORE INTO affiliate_codes (code, name, email, payout_method, payout_email, discount_percent, commission_percent, is_active) 
           VALUES (?, ?, ?, 'paypal', ?, 35, 50, 1)`,
          [code, name, email],
          function(err) {
            if (err) {
              errors++;
              if (errors <= 5) console.error(`Error inserting ${code}:`, err.message);
            } else if (this.changes > 0) {
              inserted++;
            }
            
            // Log completion when done
            if (inserted + errors >= codes.length - 5) {
              console.log(`✅ Seeded ${inserted} new affiliate codes from CSV (${errors} errors)`);
            }
          }
        );
      });
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err);
    });
}

module.exports = db;