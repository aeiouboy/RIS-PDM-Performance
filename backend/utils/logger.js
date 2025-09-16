const winston = require('winston');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Production-first logging approach
const isProduction = process.env.NODE_ENV === 'production';

// Create transports array - always start with console for production compatibility
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({ stack: true }),
      isProduction
        ? winston.format.json() // Structured logging for production
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, stack, service }) => {
              return `${timestamp} [${service || 'app'}] ${level}: ${stack || message}`;
            })
          )
    ),
  })
];

// Only add file transports in development if possible
if (!isProduction) {
  try {
    // Test if we can write files before adding file transports
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(process.cwd(), 'logs');

    // Try to create logs directory
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Test write permissions
    const testFile = path.join(logsDir, 'test.tmp');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // If we get here, file logging is available
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        handleExceptions: false,
        handleRejections: false
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        handleExceptions: false,
        handleRejections: false
      })
    );
  } catch (error) {
    // Silently fall back to console-only logging
    console.warn('File logging not available, using console only:', error.message);
  }
}

// Create logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ris-performance-dashboard' },
  transports,
  // Disable exception and rejection handling to prevent file creation issues
  exceptionHandlers: [],
  rejectionHandlers: [],
  exitOnError: false
});

module.exports = logger;