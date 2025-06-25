# 🚀 AI Content Agent - Dokku Deployment Guide

## Tổng Quan

Hướng dẫn này sẽ giúp bạn deploy **AI Content Agent** lên server sử dụng **Dokku** với 2 apps riêng biệt:

- **Frontend** (React + Vite): `ai-content-agent-fe`
- **Backend** (NestJS API): `ai-content-agent-be`

## 📋 Yêu Cầu

### Server Requirements:

- Ubuntu 20.04+ hoặc Debian 10+
- Dokku đã được cài đặt
- Domain hoặc IP public
- 2GB RAM tối thiểu
- Node.js 18+ support

### Local Requirements:

- Git
- SSH access đến server
- Dokku remote đã được cấu hình

## 🛠️ Bước 1: Chuẩn Bị Server

### 1.1 Tạo Dokku Apps trên Server

SSH vào server và chạy:

```bash
# Tạo apps
dokku apps:create ai-content-agent-fe
dokku apps:create ai-content-agent-be

# Kiểm tra apps đã tạo
dokku apps:list
```

### 1.2 Cấu Hình Environment Variables

```bash
# Backend environment variables
dokku config:set ai-content-agent-be NODE_ENV=production
dokku config:set ai-content-agent-be PORT=3001
dokku config:set ai-content-agent-be OPENAI_API_KEY=your-openai-api-key
dokku config:set ai-content-agent-be GOOGLE_AI_API_KEY=your-gemini-api-key
dokku config:set ai-content-agent-be DATABASE_URL=your-database-url

# Frontend environment variables (nếu cần)
dokku config:set ai-content-agent-fe VITE_API_URL=http://your-domain.com:3001
```

### 1.3 Cấu Hình Ports

```bash
# Frontend port (default web port 80 -> internal 5173)
dokku proxy:ports-set ai-content-agent-fe http:80:5173

# Backend port (API port 3001)
dokku proxy:ports-set ai-content-agent-be http:3001:3001
```

## 🔧 Bước 2: Chuẩn Bị Local Environment

### 2.1 Thêm Git Remotes

```bash
# Thêm remotes cho Dokku (thay your-server-ip)
git remote add dokku-fe dokku@your-server-ip:ai-content-agent-fe
git remote add dokku-be dokku@your-server-ip:ai-content-agent-be

# Kiểm tra remotes
git remote -v
```

### 2.2 Commit Changes

```bash
# Add và commit tất cả files mới
git add .
git commit -m "Add Dokku deployment configuration"
```

## 🚀 Bước 3: Deployment

### Option 1: Sử dụng Script Tự Động

```bash
# Chạy script deployment
./deploy.sh

# Chọn option:
# 1. Deploy Frontend only
# 2. Deploy Backend only
# 3. Deploy Both (Recommended)
# 4. Show setup commands
```

### Option 2: Manual Deployment

#### 3.1 Deploy Frontend

```bash
# Deploy frontend
git push dokku-fe main

# Kiểm tra logs nếu có lỗi
ssh dokku@your-server-ip logs ai-content-agent-fe
```

#### 3.2 Deploy Backend

```bash
# Switch to backend config
mv package.json package-frontend.json
mv backend-package.json package.json
echo "web: npm start" > Procfile

# Commit backend config
git add package.json Procfile
git commit -m "Backend deployment config"

# Deploy backend
git push dokku-be main

# Restore frontend config
mv package.json backend-package.json
mv package-frontend.json package.json
echo "web: npm start" > Procfile
git add package.json Procfile
git commit -m "Restore frontend config"
```

## 🔍 Bước 4: Kiểm Tra Deployment

### 4.1 Kiểm Tra Apps Status

```bash
# Kiểm tra trên server
ssh dokku@your-server-ip

# Check app status
dokku ps:report ai-content-agent-fe
dokku ps:report ai-content-agent-be

# Check app URLs
dokku url ai-content-agent-fe
dokku url ai-content-agent-be
```

### 4.2 Test Applications

```bash
# Test frontend
curl http://your-domain.com/

# Test backend health
curl http://your-domain.com:3001/api/v1/health
```

## 🌐 Bước 5: Cấu Hình Domain (Optional)

### 5.1 Thêm Custom Domain

```bash
# Add domain cho frontend
dokku domains:add ai-content-agent-fe your-domain.com
dokku domains:add ai-content-agent-fe www.your-domain.com

# Add subdomain cho backend
dokku domains:add ai-content-agent-be api.your-domain.com
```

### 5.2 Cấu Hình SSL với Let's Encrypt

```bash
# Install Let's Encrypt plugin (nếu chưa có)
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git

# Enable SSL
dokku letsencrypt:enable ai-content-agent-fe
dokku letsencrypt:enable ai-content-agent-be

# Auto-renew SSL
dokku letsencrypt:cron-job --add
```

## 📊 Monitoring & Logs

### Xem Logs

```bash
# Real-time logs
dokku logs ai-content-agent-fe --tail
dokku logs ai-content-agent-be --tail

# Previous logs
dokku logs ai-content-agent-fe
dokku logs ai-content-agent-be
```

### Restart Apps

```bash
# Restart apps nếu cần
dokku ps:restart ai-content-agent-fe
dokku ps:restart ai-content-agent-be
```

## 🔧 Troubleshooting

### Lỗi Thường Gặp:

1. **Build Failed - No package.json**

   ```bash
   # Đảm bảo package.json ở root
   ls -la package.json
   ```

2. **Port Binding Issues**

   ```bash
   # Check port config
   dokku proxy:ports ai-content-agent-fe
   dokku proxy:ports ai-content-agent-be
   ```

3. **Environment Variables Missing**

   ```bash
   # Check config
   dokku config ai-content-agent-be
   ```

4. **Frontend không connect được Backend**
   - Kiểm tra VITE_API_URL trong frontend
   - Đảm bảo CORS được cấu hình trong backend
   - Kiểm tra firewall/security groups

### Debug Commands:

```bash
# Enter app container
dokku enter ai-content-agent-be web

# Check processes
dokku ps:report ai-content-agent-be

# Rebuild app
dokku ps:rebuild ai-content-agent-fe
```

## 🎯 URLs Sau Khi Deploy

- **Frontend**: http://your-domain.com hoặc http://your-server-ip
- **Backend API**: http://your-domain.com:3001 hoặc http://your-server-ip:3001
- **API Health Check**: http://your-domain.com:3001/api/v1/health

## 📝 Next Steps

1. **Cấu hình Database**: Setup PostgreSQL với Dokku PostgreSQL plugin
2. **Monitoring**: Setup logging và monitoring
3. **Backup**: Cấu hình backup cho database và files
4. **CI/CD**: Setup auto-deployment với GitHub Actions

## 🔒 Security Checklist

- [ ] SSL certificates enabled
- [ ] Environment variables set securely
- [ ] Database credentials protected
- [ ] API rate limiting configured
- [ ] CORS properly configured
- [ ] Regular security updates

---

**🎉 Chúc mừng! AI Content Agent đã được deploy thành công lên production với Dokku!**
