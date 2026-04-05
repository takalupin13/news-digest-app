'use strict';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1;

function log(level, ...args) {
  if (LEVELS[level] >= currentLevel) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase()}] ${args.join(' ')}\n`;
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}

module.exports = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info', ...a),
  warn:  (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
