console.log('Testing env validation...');

import dotenv from 'dotenv';
dotenv.config();

try {
  const { validateEnv } = require('./config/env');
  console.log('Env module imported successfully');
  
  validateEnv();
  console.log('Env validation completed successfully');
} catch (error) {
  console.error('Env validation failed:', error);
}

console.log('Test completed'); 