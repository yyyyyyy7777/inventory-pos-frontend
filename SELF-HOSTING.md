# 🏠 Self-Hosting Guide for Inventory POS System

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Options](#deployment-options)
5. [SSL/HTTPS Setup](#sslhttps-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 20GB, Recommended 50GB+
- **CPU**: 2+ cores recommended
- **Network**: Stable internet connection

### Software Requirements
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm git nginx mysql-server

# CentOS/RHEL
sudo yum update
sudo yum install -y nodejs npm git nginx mysql-server

# Windows (using Chocolatey)
choco install nodejs git mysql-server
```

## 🗄️ Database Setup

### MySQL Installation & Configuration

#### 1. Install MySQL
```bash
# Ubuntu/Debian
sudo apt install mysql-server
sudo mysql_secure_installation

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql
```

#### 2. Create Database and User
```sql
-- Login to MySQL
sudo mysql -u root -p

-- Create database
CREATE DATABASE inventory_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'pos_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON inventory_pos.* TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit
EXIT;
```

#### 3. Initialize Database
```bash
# Run database setup
cd /path/to/your/project
npm run setup-db
```

## ⚙️ Environment Configuration

### 1. Create Environment File
Create `.env.production` in your project root:

```env
# Database Configuration
DATABASE_URL="mysql://pos_user:your_strong_password_here@localhost:3306/inventory_pos"

# Next.js Configuration
NODE_ENV="production"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your_super_secret_key_here_32_chars_min"

# Server Configuration
PORT=3000
HOST="0.0.0.0"

# Optional: Redis for caching (recommended)
REDIS_URL="redis://localhost:6379"

# Optional: Email configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### 2. Generate NextAuth Secret
```bash
# Generate secure secret
openssl rand -base64 32
```

## 🚀 Deployment Options

### Option 1: PM2 Process Manager (Recommended)

#### 1. Install PM2
```bash
npm install -g pm2
```

#### 2. Create PM2 Configuration
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'inventory-pos',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/your/project',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### 3. Create Logs Directory
```bash
mkdir -p /path/to/your/project/logs
```

#### 4. Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u your_username --hp /home/your_username
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://pos_user:password@db:3306/inventory_pos
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: inventory_pos
      MYSQL_USER: pos_user
      MYSQL_PASSWORD: password
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mysql_data:
```

#### 3. Deploy with Docker
```bash
# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### Option 3: Systemd Service

#### 1. Create Service File
Create `/etc/systemd/system/inventory-pos.service`:

```ini
[Unit]
Description=Inventory POS System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable inventory-pos
sudo systemctl start inventory-pos
sudo systemctl status inventory-pos
```

## 🌐 SSL/HTTPS Setup

### Option 1: Let's Encrypt (Free)

#### 1. Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### 2. Obtain SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com
```

#### 3. Auto-renewal
```bash
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Self-Signed Certificate

#### 1. Generate Certificate
```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx-selfsigned.key \
  -out /etc/nginx/ssl/nginx-selfsigned.crt
```

## 📋 Nginx Configuration

Create `/etc/nginx/sites-available/inventory-pos`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/inventory-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 Monitoring & Maintenance

### PM2 Monitoring
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs inventory-pos

# Restart application
pm2 restart inventory-pos

# Update application
pm2 delete inventory-pos
pm2 start ecosystem.config.js
```

### Log Management
```bash
# Setup log rotation
sudo nano /etc/logrotate.d/inventory-pos

# Content:
/path/to/your/project/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Health Check Script
Create `health-check.sh`:
```bash
#!/bin/bash

# Check if the application is responding
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ $response != "200" ]; then
    echo "Application is down, restarting..."
    pm2 restart inventory-pos
    # Send notification (optional)
    # curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" -d "chat_id=<CHAT_ID>" -d "text=Inventory POS is down, restarting..."
else
    echo "Application is running normally"
fi
```

Add to crontab for automatic monitoring:
```bash
# Edit crontab
crontab -e

# Add health check every 5 minutes
*/5 * * * * /path/to/your/project/health-check.sh >> /var/log/pos-health.log 2>&1
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### 2. Database Connection Failed
```bash
# Check MySQL status
sudo systemctl status mysql

# Test connection
mysql -u pos_user -p inventory_pos

# Check logs
sudo tail -f /var/log/mysql/error.log
```

#### 3. Permission Issues
```bash
# Fix file permissions
sudo chown -R www-data:www-data /path/to/your/project
sudo chmod -R 755 /path/to/your/project
```

#### 4. Memory Issues
```bash
# Check memory usage
free -h

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Performance Optimization

#### 1. Enable Caching
Add to `next.config.mjs`:
```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['prisma']
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false
}
```

#### 2. Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_products_cabinet ON products(cabinet);
CREATE INDEX idx_sales_staff ON sales(staffName);
```

## 🔄 Backup Strategy

### Database Backup Script
Create `backup-db.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="inventory_pos"
DB_USER="pos_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

Add to crontab for daily backups:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/your/project/backup-db.sh
```

## 🚀 Quick Deployment Script

Create `deploy.sh`:
```bash
#!/bin/bash

echo "🚀 Deploying Inventory POS System..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Build application
npm run build

# Restart with PM2
pm2 restart inventory-pos

# Clean up old logs
find ./logs -name "*.log" -mtime +7 -delete

echo "✅ Deployment completed successfully!"
```

Make it executable:
```bash
chmod +x deploy.sh
```

## 📞 Support

For additional help:
1. Check application logs: `pm2 logs inventory-pos`
2. Check system logs: `sudo journalctl -u inventory-pos`
3. Monitor system resources: `htop`
4. Test API endpoints: `curl http://localhost:3000/api/health`

---

## 🎉 You're Ready!

Your Inventory POS System is now self-hosted and ready for production use! 

**Next Steps:**
1. Test all functionality
2. Set up monitoring alerts
3. Configure backup schedule
4. Train your staff

**Need Help?** Check the troubleshooting section or review the logs for any issues.
