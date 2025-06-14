console.log('Testing passport import...');

import dotenv from 'dotenv';
dotenv.config();

try {
  const passport = require('./config/passport');
  console.log('Passport imported successfully');
  console.log('Passport default export:', typeof passport.default);
} catch (error) {
  console.error('Passport import failed:', error);
  console.error('Error stack:', error.stack);
}

console.log('Test completed'); 