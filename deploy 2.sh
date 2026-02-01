#!/bin/bash
# CardCraft Deployment Script
# Usage: ./deploy.sh [railway|render|vercel]

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/frontend" && pwd)"

echo "🎨 CardCraft Deployment Script"
echo "==============================="
echo ""

# Check for required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

deploy_railway() {
    echo "🚀 Deploying to Railway..."
    echo ""
    
    check_command railway
    
    cd "$BACKEND_DIR"
    
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Copying from .env.example..."
        cp .env.example .env
        echo "📝 Please edit .env and add your Stripe API keys before deploying."
        exit 1
    fi
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🔗 Logging into Railway..."
    railway login
    
    echo "🆕 Creating project..."
    railway init
    
    echo "⬆️  Deploying backend..."
    railway up
    
    echo "🌍 Getting public URL..."
    railway domain
    
    echo ""
    echo "✅ Backend deployed to Railway!"
    echo "📝 Save the URL - you'll need it for the frontend."
}

deploy_render() {
    echo "🚀 Deploying to Render..."
    echo ""
    
    cd "$BACKEND_DIR"
    
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Copying from .env.example..."
        cp .env.example .env
        echo "📝 Please edit .env and add your Stripe API keys before deploying."
        exit 1
    fi
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo ""
    echo "📝 To deploy to Render:"
    echo "   1. Push code to GitHub"
    echo "   2. Go to https://dashboard.render.com"
    echo "   3. Click 'New +' → 'Web Service'"
    echo "   4. Connect your GitHub repo"
    echo "   5. Use these settings:"
    echo "      - Runtime: Docker"
    echo "      - Dockerfile Path: ./backend/Dockerfile"
    echo "      - Add environment variables from .env"
    echo ""
}

deploy_vercel() {
    echo "🚀 Deploying frontend to Vercel..."
    echo ""
    
    check_command vercel
    
    cd "$FRONTEND_DIR"
    
    echo "📝 Make sure to update API_URL in app.js to point to your backend!"
    echo ""
    echo "Current API_URL setting:"
    grep "const API_URL" app.js
    echo ""
    read -p "Have you updated the API_URL? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "📝 Please update API_URL in app.js first, then run this again."
        exit 1
    fi
    
    echo "⬆️  Deploying to Vercel..."
    vercel --prod
    
    echo ""
    echo "✅ Frontend deployed to Vercel!"
}

# Main
case "$1" in
    railway)
        deploy_railway
        ;;
    render)
        deploy_render
        ;;
    vercel)
        deploy_vercel
        ;;
    *)
        echo "Usage: ./deploy.sh [railway|render|vercel]"
        echo ""
        echo "Options:"
        echo "  railway  - Deploy backend to Railway (recommended)"
        echo "  render   - Deploy backend to Render"
        echo "  vercel   - Deploy frontend to Vercel"
        echo ""
        echo "Recommended workflow:"
        echo "  1. ./deploy.sh railway  (deploy backend)"
        echo "  2. Update API_URL in frontend/app.js"
        echo "  3. ./deploy.sh vercel   (deploy frontend)"
        exit 1
        ;;
esac