#!/usr/bin/env node
/**
 * CardCraft Referral Dashboard
 * Local monitoring tool for affiliate tracking
 * Usage: node referral-dashboard.js [command]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = '/tmp/cardcraft-referrals-latest.txt';
const REFERRALS_DB = '/tmp/cardcraft-referrals-db.json';
const API_URL = 'https://pacific-vision-production.up.railway.app/api';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function printHeader() {
  console.clear();
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          🎯 CardCraft Referral Dashboard                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
}

async function fetchFromAPI() {
  try {
    // Try API first (no auth needed for local dashboard)
    const response = await fetch(`${API_URL}/admin/referral-log?token=collin-admin-2026`);
    if (response.ok) {
      const data = await response.json();
      // Convert JSON entries back to log format
      const logContent = data.entries.map(e => 
        `[${e.timestamp}] ${e.type}: ${JSON.stringify(e.data)}`
      ).join('\n');
      fs.writeFileSync(LOG_FILE, logContent);
      return true;
    }
  } catch (e) {
    // Fall back to Railway CLI
    try {
      execSync(`railway download backend/referral-log.txt ${LOG_FILE} 2>/dev/null`, { stdio: 'pipe' });
      return true;
    } catch (e2) {
      // If file doesn't exist yet, create empty one
      if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
      }
    }
  }
  return false;
}

function parseLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const entries = [];
  
  content.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    const match = line.match(/\[(.*?)\] (\w+): (.*)/);
    if (match) {
      try {
        const data = JSON.parse(match[3]);
        entries.push({
          timestamp: match[1],
          type: match[2],
          data: data
        });
      } catch (e) {}
    }
  });
  
  return entries;
}

async function showSummary() {
  printHeader();
  
  const fetched = await fetchFromAPI();
  const entries = parseLog();
  
  if (!fetched && entries.length === 0) {
    console.log(`${colors.yellow}⚠️  No data yet. Waiting for first referral...${colors.reset}\n`);
    return;
  }
  
  if (fetched) {
    console.log(`${colors.green}✅ Data synced from Railway${colors.reset}\n`);
  }
  
  // Group by code
  const byCode = {};
  let totalCommission = 0;
  let totalSales = 0;
  
  entries.forEach(entry => {
    if (entry.type === 'PURCHASE_COMPLETED') {
      const code = entry.data.code;
      if (!byCode[code]) {
        byCode[code] = { 
          code, 
          sales: 0, 
          commission: 0,
          customers: [],
          lastSale: null
        };
      }
      byCode[code].sales++;
      byCode[code].commission += entry.data.commission_amount || 0;
      byCode[code].customers.push(entry.data.customer_email);
      byCode[code].lastSale = entry.timestamp;
      totalCommission += entry.data.commission_amount || 0;
      totalSales++;
    }
  });
  
  // Display summary
  console.log(`${colors.bright}📊 OVERVIEW${colors.reset}`);
  console.log('─'.repeat(60));
  console.log(`Total Sales:      ${colors.green}${totalSales}${colors.reset}`);
  console.log(`Total Payouts:    ${colors.green}$${(totalCommission/100).toFixed(2)}${colors.reset}`);
  console.log(`Unique Codes:     ${Object.keys(byCode).length}`);
  console.log('');
  
  if (Object.keys(byCode).length > 0) {
    console.log(`${colors.bright}💰 PAYOUTS BY CODE${colors.reset}`);
    console.log('─'.repeat(60));
    console.log(`${colors.bright}Code                Sales    Commission    Last Sale${colors.reset}`);
    console.log('─'.repeat(60));
    
    Object.values(byCode)
      .sort((a, b) => b.commission - a.commission)
      .forEach(item => {
        const date = item.lastSale ? new Date(item.lastSale).toLocaleDateString() : 'N/A';
        console.log(
          `${item.code.padEnd(18)} ` +
          `${item.sales.toString().padStart(5)}    ` +
          `${colors.green}$${(item.commission/100).toFixed(2).padStart(10)}${colors.reset}    ` +
          `${date}`
        );
      });
    
    console.log('─'.repeat(60));
    console.log(`${colors.bright}TOTAL:             ${totalSales.toString().padStart(5)}    ${colors.green}$${(totalCommission/100).toFixed(2).padStart(10)}${colors.reset}`);
    console.log('');
  }
  
  // Recent activity
  const recentPurchases = entries
    .filter(e => e.type === 'PURCHASE_COMPLETED')
    .slice(-10)
    .reverse();
  
  if (recentPurchases.length > 0) {
    console.log(`${colors.bright}🕐 RECENT PURCHASES (last 10)${colors.reset}`);
    console.log('─'.repeat(60));
    
    recentPurchases.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      const amount = entry.data.order_amount ? `$${(entry.data.order_amount/100).toFixed(0)}` : 'N/A';
      const commission = entry.data.commission_amount ? `$${(entry.data.commission_amount/100).toFixed(2)}` : 'N/A';
      
      console.log(`${colors.cyan}${date}${colors.reset}`);
      console.log(`  Code: ${entry.data.code} | Amount: ${amount} | Your cut: ${colors.green}${commission}${colors.reset}`);
      console.log(`  Customer: ${entry.data.customer_email || 'N/A'}`);
      console.log('');
    });
  }
  
  // Recent code applications
  const recentApps = entries
    .filter(e => e.type === 'CODE_APPLIED')
    .slice(-5)
    .reverse();
  
  if (recentApps.length > 0) {
    console.log(`${colors.bright}🔑 RECENT CODE APPLICATIONS (last 5)${colors.reset}`);
    console.log('─'.repeat(60));
    
    recentApps.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      console.log(`${date}: ${entry.data.code} (${entry.data.name})`);
    });
    console.log('');
  }
  
  console.log(`${colors.yellow}Last updated: ${new Date().toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}Run with 'watch' flag to auto-refresh every 30 seconds${colors.reset}`);
}

async function exportCSV() {
  await fetchFromAPI();
  const entries = parseLog();
  
  const purchases = entries.filter(e => e.type === 'PURCHASE_COMPLETED');
  
  if (purchases.length === 0) {
    console.log('No purchase data to export');
    return;
  }
  
  const csvPath = `/tmp/cardcraft-payouts-${Date.now()}.csv`;
  const csv = [
    'Date,Code,Customer Email,Order Amount,Commission,Status',
    ...purchases.map(e => {
      const d = e.data;
      return `${e.timestamp},${d.code || ''},${d.customer_email || ''},${(d.order_amount/100).toFixed(2)},${(d.commission_amount/100).toFixed(2)},pending`;
    })
  ].join('\n');
  
  fs.writeFileSync(csvPath, csv);
  console.log(`${colors.green}✅ Exported to: ${csvPath}${colors.reset}`);
}

async function watchMode() {
  await showSummary();
  console.log(`\n${colors.yellow}👀 Watching for changes... (Ctrl+C to exit)${colors.reset}\n`);
  
  setInterval(async () => {
    await showSummary();
  }, 30000); // Refresh every 30 seconds
}

// Main
const command = process.argv[2];

(async () => {
  switch (command) {
    case 'export':
      await exportCSV();
      break;
    case 'watch':
      await watchMode();
      break;
    case 'help':
    case '--help':
    case '-h':
    console.log(`
CardCraft Referral Dashboard

Usage: node referral-dashboard.js [command]

Commands:
  (none)     Show summary dashboard
  watch      Auto-refresh every 30 seconds
  export     Export payouts to CSV
  help       Show this help

Examples:
  node referral-dashboard.js
  node referral-dashboard.js watch
  node referral-dashboard.js export
`);
    break;
    default:
      await showSummary();
  }
})();
