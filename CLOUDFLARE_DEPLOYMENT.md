# Cloudflare Deployment Guide - TheWheezardPH

## Step 1: Buy Your Domain
1. Go to [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
2. Search for: `thewheezardph.com`
3. Purchase domain (~$10-15/year)
4. Domain will be automatically configured for Cloudflare

## Step 2: Install Cloudflare CLI
```bash
# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Login to Cloudflare
wrangler auth login
```

## Step 3: Build Your App
```bash
# Build your Next.js app
npm run build

# The build will be in the 'out' directory
```

## Step 4: Deploy to Cloudflare Pages
```bash
# Create new Cloudflare Pages project
wrangler pages project create the-wheezard-ph

# Deploy to Cloudflare
wrangler pages deploy out --project-name the-wheezard-ph
```

## Step 5: Configure Custom Domain
```bash
# Add custom domain to your project
wrangler pages domain add thewheezardph.com
```

## Step 6: Set Environment Variables
In Cloudflare Dashboard:
1. Go to Pages → TheWheezardPH → Settings → Environment variables
2. Add these environment variables:
```
DATABASE_URL=your_planetscale_connection_string
NEXTAUTH_URL=https://thewheezardph.com
NEXTAUTH_SECRET=your_strong_secret_key
NODE_ENV=production
```

## Step 7: Database Setup (PlanetScale)
1. Create account at [planetscale.com](https://planetscale.com)
2. Create database: `the-wheezard-ph`
3. Get connection string
4. Add to Cloudflare environment variables

## Step 8: Final Configuration
```bash
# Deploy with environment variables
wrangler pages deploy out --project-name the-wheezard-ph
```

## Your URLs
- **Production**: https://thewheezardph.com
- **Staging**: https://the-wheezard-ph-staging.pages.dev

## Automatic Deployments (Optional)
Connect to GitHub for automatic deployments:
1. Go to Cloudflare Dashboard
2. Pages → TheWheezardPH → Settings
3. Connect GitHub repository
4. Deploy on every push

## Security Features Enabled
✅ DDoS Protection
✅ SSL Certificate
✅ Web Application Firewall
✅ Bot Protection
✅ Rate Limiting

## Post-Deployment Checklist
□ Test website loads at https://thewheezardph.com
□ Test admin login functionality
□ Test product management
□ Test sales tracking
□ Check SSL certificate
□ Verify database connection
□ Test mobile responsiveness

## Quick Deploy Commands
```bash
# One-time setup
npm install -g wrangler
wrangler auth login

# Deploy
npm run build
wrangler pages deploy out --project-name the-wheezard-ph
```

## Troubleshooting
If deployment fails:
1. Check build logs in Cloudflare Dashboard
2. Verify environment variables
3. Ensure database is accessible
4. Check domain DNS settings

## Support
- Cloudflare Docs: https://developers.cloudflare.com/pages
- PlanetScale Docs: https://planetscale.com/docs
