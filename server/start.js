process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = require('./app');
const prisma = require('./db');
const { config } = require('./config');
const { logger } = require('./logger');

const server = app.listen(config.port, () => {
  logger.info(`Travel Glow running at http://localhost:${config.port}`);
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down.');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
