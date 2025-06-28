# AI Content Agent - Deployment Checklist

## Pre-Deployment Checklist

### 1. Code Preparation ✅

- [x] Remove test files
- [x] Clean log files
- [x] Create .env.example files
- [x] Backend builds successfully
- [x] Frontend builds successfully
- [x] No sensitive data in code

### 2. Environment Configuration

- [ ] Set production environment variables
  - [ ] Database credentials
  - [ ] API keys (OpenAI, Gemini, Claude)
  - [ ] JWT secret
  - [ ] Redis URL
  - [ ] WordPress credentials
- [ ] Configure domain and SSL certificates
- [ ] Set up monitoring and logging

### 3. Database Setup

- [ ] Create production database
- [ ] Run migrations
- [ ] Create admin user
- [ ] Backup strategy configured

### 4. Infrastructure

- [ ] Server provisioned
- [ ] Docker installed (if using containers)
- [ ] Nginx configured
- [ ] PM2 installed (for process management)
- [ ] Redis server running

### 5. Security

- [ ] Firewall rules configured
- [ ] SSL certificates installed
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers added

### 6. Deployment Steps

#### Backend Deployment

```bash
# 1. Clone repository
git clone <repository-url>
cd ai-content-agent

# 2. Install dependencies
cd backend
npm ci --production

# 3. Build backend
chmod +x build-prod.sh
./build-prod.sh

# 4. Set environment variables
cp .env.example .env
# Edit .env with production values

# 5. Run migrations
npm run migrate

# 6. Start with PM2
pm2 start dist/server.js --name ai-content-backend
pm2 save
pm2 startup
```

#### Frontend Deployment

```bash
# 1. Build frontend
cd ../frontend
npm ci
npm run build

# 2. Deploy to web server
# Copy dist/ contents to web server root
# Or use Nginx to serve static files
```

### 7. Post-Deployment

- [ ] Test all API endpoints
- [ ] Verify frontend connectivity
- [ ] Test content generation
- [ ] Test WordPress publishing
- [ ] Monitor logs for errors
- [ ] Set up backup automation

### 8. Monitoring Setup

- [ ] Configure uptime monitoring
- [ ] Set up error alerting
- [ ] Configure performance monitoring
- [ ] Set up log aggregation

## Production Configuration Files

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /var/www/ai-content-agent/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 Ecosystem File

```javascript
module.exports = {
  apps: [
    {
      name: "ai-content-backend",
      script: "./dist/server.js",
      cwd: "/var/www/ai-content-agent/backend",
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
```

## Rollback Plan

1. Keep previous version backup
2. Database backup before deployment
3. Quick rollback script ready
4. Monitor for 24 hours after deployment

## Support Contacts

- Technical Lead: [Contact Info]
- DevOps: [Contact Info]
- Emergency: [Contact Info]
