# 🚀 Deployment Guide for Inventory POS System

## 📋 Table of Contents
1. [Cloud Deployment Options](#cloud-deployment-options)
2. [Self-Hosting Setup](#self-hosting-setup)
3. [Offline Access Setup](#offline-access-setup)
4. [Database Setup](#database-setup)
5. [Environment Variables](#environment-variables)

## ☁️ Cloud Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Pros:**
- Free tier available
- Automatic HTTPS
- Global CDN
- Easy GitHub integration
- ✅ Already configured and should work

**Cons:**
- Vendor lock-in
- Limited server-side functions

### Option 2: Vercel + PlanetScale (Recommended for Production)

#### 1. Setup PlanetScale Database
1. Create account at [planetscale.com](https://planetscale.com)
2. Create new database: `inventory-pos`
3. Get connection string from dashboard
4. Update your `.env` with PlanetScale URL

### 2. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts to connect to GitHub
# Set environment variables in Vercel dashboard:
# - DATABASE_URL (from PlanetScale)
# - NEXTAUTH_SECRET (generate random string)
```

### 3. Environment Variables Required
```
DATABASE_URL=your_planetscale_connection_string
NEXTAUTH_URL=your_vercel_app_url
NEXTAUTH_SECRET=random_32_character_string
NODE_ENV=production
```

## Option 2: Railway (All-in-One)

### 1. Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 2. Add MySQL Database
- In Railway dashboard, add MySQL service
- Connect to your app using `DATABASE_URL`

## Pre-Deployment Checklist

### 1. Update Database Configuration
- Remove hardcoded localhost URL from `next.config.mjs`
- Use environment variables properly

### 2. Build Test
```bash
npm run build
npm start
```

### 3. Database Migration
```bash
npx prisma generate
npx prisma db push
```

## Post-Deployment

### 1. Create Admin User
- Access your deployed app
- Navigate to `/restore-admin` or use admin creation script

### 2. Test All Features
- Login functionality
- Product management
- Sales tracking
- Analytics

## Important Notes

- Your current config has hardcoded database URL - this needs to be environment-based
- Images are unoptimized in config (good for deployment)
- TypeScript build errors are ignored (consider fixing for production)

## Free Tier Limitations

- **Vercel**: 100GB bandwidth/month
- **PlanetScale**: 5GB storage
- **Railway**: $5 credit/month (~small app usage)

For higher traffic, consider paid plans.
