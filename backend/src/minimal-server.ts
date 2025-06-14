import express from 'express';
import dotenv from 'dotenv';

console.log('🔧 Loading environment variables...');
dotenv.config();

console.log('🚀 Starting minimal server...');

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "localhost";

console.log(`📋 Configuration:`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - HOST: ${HOST}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV ?? "development"}`);

app.use(express.json());

app.get('/health', (req, res) => {
  console.log('📞 Health endpoint called');
  res.json({
    success: true,
    message: 'Minimal server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? "development"
  });
});

app.get('/test', (req, res) => {
  console.log('📞 Test endpoint called');
  res.json({
    success: true,
    message: 'Test endpoint working',
    server: 'minimal-server'
  });
});

console.log('🔧 Setting up server listener...');

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Minimal server running on http://${HOST}:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - GET  http://${HOST}:${PORT}/health`);
  console.log(`   - GET  http://${HOST}:${PORT}/test`);
  console.log(`🎯 Server is ready to accept connections!`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('🔧 Server setup completed'); 