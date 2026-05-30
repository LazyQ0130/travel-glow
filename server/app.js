const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const regionRoutes = require('./routes/regions');
const checkinRoutes = require('./routes/checkins');
const photoRoutes = require('./routes/photos');
const statsRoutes = require('./routes/stats');
const mapRoutes = require('./routes/map');
const { uploadDir } = require('./upload');
const prisma = require('./db');
const { config, assertRuntimeConfig, corsOptions } = require('./config');
const { logger, requestLogger } = require('./logger');
const { notFound, errorHandler } = require('./errors');

assertRuntimeConfig();

const app = express();

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors(corsOptions()));
app.use(requestLogger());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: config.appName,
    version: config.version,
    time: new Date().toISOString()
  });
});

app.get('/api/ready', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ready',
      database: 'ok',
      time: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/map', mapRoutes);

app.use(notFound);

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
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
}

module.exports = app;
