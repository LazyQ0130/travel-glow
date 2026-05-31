process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = require('./app');
const prisma = require('./db');
const { config } = require('./config');
const { logger } = require('./logger');
const { startServer } = require('./start-server');

startServer(app, { config, logger, prisma });
