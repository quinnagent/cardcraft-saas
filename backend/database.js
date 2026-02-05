const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'cardcraft.db');

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
      discount_percent INTEGER DEFAULT 40,
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
}

module.exports = db;