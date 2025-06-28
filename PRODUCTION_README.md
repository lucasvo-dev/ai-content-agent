# AI Content Agent - Production Deployment Guide

## System Requirements

- Node.js 20+
- PostgreSQL 15+ or SQLite
- Redis 7+
- PM2 (for process management)
- Nginx (for reverse proxy)
- 2GB+ RAM
- 10GB+ disk space

## Quick Start

1. **Clone and prepare**

```bash
git clone <repository-url>
cd ai-content-agent
chmod +x deploy-production.sh
```

2. **Configure environment**

```bash
cd backend
cp .env.example .env
# Edit .env with your production values
```

3. **Run deployment**

```bash
cd ..
./deploy-production.sh
```

## Manual Deployment

### Backend

```bash
cd backend
npm ci --production
./build-prod.sh
pm2 start ecosystem.config.js --env production
```

### Frontend

```bash
cd frontend
npm ci
npm run build
# Copy dist/ to your web server
```

## Environment Variables

### Required

- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong random string
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key (optional)
- `CLAUDE_API_KEY` - Anthropic Claude API key (optional)

### Optional

- `REDIS_URL` - Redis connection (default: localhost:6379)
- `PORT` - Backend port (default: 3001)
- `LOG_LEVEL` - Logging level (default: info)

## Monitoring

### PM2 Commands

```bash
pm2 status              # Check status
pm2 logs                # View logs
pm2 monit              # Real-time monitoring
pm2 restart all        # Restart all processes
```

### Health Check

```bash
curl http://localhost:3001/api/v1/health
```

## Backup

### Database

```bash
# PostgreSQL
pg_dump -U username -d ai_content_agent > backup.sql

# SQLite
cp data/database.sqlite backup.sqlite
```

### Application

```bash
tar -czf ai-content-backup.tar.gz --exclude=node_modules --exclude=logs .
```

## Troubleshooting

### Backend won't start

1. Check logs: `pm2 logs ai-content-backend`
2. Verify .env file exists and is valid
3. Check database connection
4. Ensure port 3001 is available

### Frontend 404 errors

1. Verify Nginx configuration
2. Check file permissions
3. Ensure dist/ files are in correct location

### AI generation fails

1. Verify API keys are valid
2. Check API rate limits
3. Review error logs for details

## Security Checklist

- [ ] Change default passwords
- [ ] Enable firewall (allow 80, 443, 22)
- [ ] Configure SSL certificates
- [ ] Set up fail2ban
- [ ] Regular security updates
- [ ] Backup automation

## Performance Tuning

### PM2 Configuration

- Adjust `instances` based on CPU cores
- Set `max_memory_restart` based on available RAM

### Database

- Add indexes for frequently queried fields
- Regular VACUUM (PostgreSQL)
- Connection pooling

### Nginx

- Enable gzip compression
- Configure caching headers
- Set up rate limiting

## Support

For issues or questions:

1. Check logs first
2. Review error messages
3. Consult documentation
4. Contact support team
