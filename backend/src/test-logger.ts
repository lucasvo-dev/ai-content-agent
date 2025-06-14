console.log('Testing logger import...');

try {
  const { logger } = require('./utils/logger');
  console.log('Logger imported successfully');
  
  logger.info('Test log message');
  console.log('Logger test completed');
} catch (error) {
  console.error('Logger import failed:', error);
}

console.log('Test completed'); 