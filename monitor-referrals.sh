#!/bin/bash
# CardCraft Referral Monitor
# Fetches and displays referral data from Railway

echo "🎯 CardCraft Referral Monitor"
echo "=============================="
echo ""

# Check if Railway CLI is logged in
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged into Railway"
    echo "Run: railway login"
    exit 1
fi

# Get the project ID
PROJECT_ID=$(railway project 2>/dev/null | grep -oP 'Project: \K[^ ]+' || echo "")

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No Railway project selected"
    echo "Run: railway link"
    exit 1
fi

echo "📊 Fetching latest referral data..."
echo ""

# Download the referral log
TEMP_LOG="/tmp/cardcraft-referrals-$(date +%s).txt"
railway download backend/referral-log.txt "$TEMP_LOG" 2>/dev/null || echo "# No log file yet" > "$TEMP_LOG"

# Display summary
echo "📈 RECENT ACTIVITY (last 20 entries):"
echo "--------------------------------------"
tail -20 "$TEMP_LOG" 2>/dev/null | while read line; do
    echo "$line"
done

echo ""
echo "💰 PAYOUT SUMMARY BY CODE:"
echo "--------------------------"

# Parse PURCHASE_COMPLETED entries and sum by code
grep "PURCHASE_COMPLETED" "$TEMP_LOG" 2>/dev/null | \
    sed 's/.*PURCHASE_COMPLETED: //' | \
    node -e '
        const entries = [];
        let line;
        while (line = require("fs").readFileSync(0, "utf-8")) {
            try {
                const data = JSON.parse(line);
                entries.push(data);
            } catch(e) {}
        }
        
        const summary = {};
        entries.forEach(e => {
            if (!summary[e.code]) summary[e.code] = { count: 0, commission: 0 };
            summary[e.code].count++;
            summary[e.code].commission += e.commission_amount || 0;
        });
        
        Object.entries(summary).forEach(([code, data]) => {
            console.log(`${code}: ${data.count} sales, $${(data.commission/100).toFixed(2)} owed`);
        });
        
        const total = Object.values(summary).reduce((a, b) => a + b.commission, 0);
        console.log(`\nTOTAL PAYOUTS OWED: $${(total/100).toFixed(2)}`);
    ' 2>/dev/null || echo "No completed purchases yet"

echo ""
echo "📁 Full log saved to: $TEMP_LOG"
echo ""
echo "Commands:"
echo "  ./monitor-referrals.sh    # View summary"
echo "  cat $TEMP_LOG             # View full log"
echo "  rm $TEMP_LOG              # Clean up"

# Keep the temp file path for reference
ln -sf "$TEMP_LOG" /tmp/cardcraft-referrals-latest.txt 2>/dev/null
