# AI Content Agent

Automated blog writing and publishing system for WordPress and Facebook platforms using AI technology.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## 🎯 Overview

AI Content Agent là một hệ thống tự động tạo và xuất bản nội dung blog sử dụng công nghệ AI. Hệ thống có khả năng:

- **🤖 AI Content Generation**: Tự động tạo nội dung blog chất lượng cao với OpenAI GPT-4
- **📝 WordPress Integration**: Xuất bản trực tiếp lên WordPress sites
- **📱 Facebook Publishing**: Đăng nội dung lên Facebook business pages
- **📊 Analytics Dashboard**: Theo dõi hiệu suất và phân tích dữ liệu
- **⏰ Scheduling System**: Lên lịch xuất bản tự động
- **🔒 Security**: Authentication & authorization hoàn chỉnh

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Supabase)    │
│   Port: 5173    │    │   Port: 3001    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Services   │    │   External APIs │    │   File Storage  │
│   (OpenAI)      │    │   (WP, FB)      │    │   (Local/Cloud) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Docker** (optional)
- **Git**

### Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd ai-content-agent
```

2. **Install dependencies**

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Environment Setup**

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Update với your API keys
nano backend/.env
```

4. **Start Development Servers**

**Option 1: Manual Start**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Option 2: Docker (Recommended)**

```bash
cd docker
docker-compose up -d
```

### Access Applications

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/v1/health

## 📁 Project Structure

```
ai-content-agent/
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── config/            # Database, environment config
│   │   ├── middleware/        # Auth, error handling, logging
│   │   ├── routes/           # API routes (auth, content, etc.)
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   └── server.ts         # Main server file
│   ├── logs/                 # Application logs
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # State management
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── main.tsx         # Entry point
│   ├── public/              # Static assets
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── Dockerfile
├── docker/                   # Docker configuration
│   ├── docker-compose.yml
│   └── nginx.conf
├── docs/                     # Project documentation
│   ├── specs.md
│   ├── technical-architecture.md
│   ├── api-documentation.md
│   ├── best-practices.md
│   └── project_progress.md
├── shared/                   # Shared utilities
└── README.md
```

## ⚙️ Configuration

### Environment Variables

Backend environment variables (`.env`):

```bash
# Server
NODE_ENV=development
PORT=3001
HOST=localhost

# Database (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d

# AI Services
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4-turbo-preview

# External Services
WORDPRESS_DEFAULT_USERNAME=your_wp_username
WORDPRESS_DEFAULT_APP_PASSWORD=your_wp_app_password
FACEBOOK_APP_ID=your_fb_app_id
FACEBOOK_APP_SECRET=your_fb_app_secret

# Redis
REDIS_URL=redis://localhost:6379
```

## 🔧 Development

### Backend Development

```bash
cd backend

# Development with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Frontend Development

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild services
docker-compose up -d --build
```

## 📚 API Documentation

### Health Check

```bash
GET /api/v1/health
```

**Response:**

```json
{
  "success": true,
  "message": "AI Content Agent API is running",
  "timestamp": "2025-06-12T04:18:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### Authentication

**Register User:**

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "User Name",
  "password": "password123"
}
```

**Login:**

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Content Management

**Generate Content:**

```bash
POST /api/v1/content/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "AI in Web Development",
  "length": "medium",
  "tone": "professional"
}
```

Xem thêm chi tiết trong [API Documentation](docs/api-documentation.md).

## 🧪 Testing

### Unit Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Integration Tests

```bash
# API integration tests
cd backend
npm run test:integration

# E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Production Build

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring

### Logs

```bash
# Backend logs
tail -f backend/logs/app.log

# Docker logs
docker-compose logs -f backend
```

### Health Monitoring

- **Health Check**: `/api/v1/health`
- **Detailed Health**: `/api/v1/health/detailed`
- **Readiness**: `/api/v1/health/ready`
- **Liveness**: `/api/v1/health/live`

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript + React
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format

## 📝 Documentation

- [📋 Project Specifications](docs/specs.md)
- [🏗️ Technical Architecture](docs/technical-architecture.md)
- [📡 API Documentation](docs/api-documentation.md)
- [✅ Best Practices](docs/best-practices.md)
- [📊 Project Progress](docs/project_progress.md)

## 🔒 Security

- **JWT Authentication** với refresh tokens
- **Rate limiting** cho API endpoints
- **Input validation** với sanitization
- **CORS** configuration
- **Environment variable** protection
- **Security headers** (helmet.js)

## 🐛 Known Issues

- ⚠️ **TypeScript Errors**: 138 compilation errors cần fix
- 🔧 **Type Definitions**: Một số interface cần cập nhật
- 📝 **Environment Variables**: Strict type checking cho process.env

## 📞 Support

- **Issues**: Create GitHub issue với detailed description
- **Documentation**: Check `/docs` folder
- **API**: Use `/api/v1/health` để check server status

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **OpenAI** for GPT-4 API
- **Supabase** for database hosting
- **Vercel** for deployment platform
- **WordPress** và **Facebook** APIs

---

**Status**: 🟢 Active Development  
**Version**: 1.0.0-beta  
**Last Updated**: 12/06/2025 at 04:18 AM

Made with ❤️ using TypeScript, React, and Node.js
