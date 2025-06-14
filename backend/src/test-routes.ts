console.log('Testing routes import...');

import dotenv from 'dotenv';
dotenv.config();

try {
  console.log('Testing health routes...');
  const healthRoutes = require('./routes/health');
  console.log('Health routes imported successfully');
  
  console.log('Testing auth routes...');
  const authRoutes = require('./routes/auth');
  console.log('Auth routes imported successfully');
  
  console.log('Testing AI routes...');
  const aiRoutes = require('./routes/ai');
  console.log('AI routes imported successfully');
  
} catch (error) {
  console.error('Routes import failed:', error);
  console.error('Error stack:', error.stack);
}

console.log('Test completed'); 