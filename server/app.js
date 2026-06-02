const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

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
const { startServer } = require('./start-server');
const { createCsrfProtection } = require('./middleware/csrf');

assertRuntimeConfig();

const app = express();
const csrfProtection = createCsrfProtection({
  signingKey: config.jwtSecret,
  secure: config.isProduction,
  sameSite: 'strict',
  path: '/api'
});

function csrfTokenHeader(req, res, next) {
  const token = req.csrfToken();
  res.set('X-CSRF-Token', token);
  res.locals.csrfToken = token;
  next();
}

app.disable('x-powered-by');
if (config.trustProxy) {
  app.set('trust proxy', 1);
}
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));
app.use(cors(corsOptions()));
app.use(requestLogger());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/api', csrfProtection, csrfTokenHeader);
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

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
  startServer(app, { config, logger, prisma });
}

module.exports = app;
