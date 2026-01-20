const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function formatTimestamp() {
  return new Date().toISOString();
}

export const logger = {
  info: (message, ...args) => {
    // Only log info if explicitly needed or for startup/important events
    // For now, keeping it but cleaning up timestamps if not debug
    console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`${colors.red}[ERROR]${colors.reset} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${message}`, ...args);
    }
  },
  success: (message, ...args) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`, ...args);
  },
};
