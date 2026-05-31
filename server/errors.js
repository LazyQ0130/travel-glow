const { Prisma } = require('@prisma/client');
const { config } = require('./config');
const { logger } = require('./logger');

class AppError extends Error {
  constructor(statusCode, message, code = 'REQUEST_ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function errorResponse(error) {
  if (error.type === 'entity.too.large') {
    return {
      statusCode: 413,
      body: { message: 'Request body is too large.', code: 'PAYLOAD_TOO_LARGE' }
    };
  }

  if (error instanceof AppError || error.statusCode || error.status) {
    const statusCode = error.statusCode || error.status;
    return {
      statusCode,
      body: {
        message: error.message,
        code: error.code || 'REQUEST_ERROR',
        ...(error.details !== undefined ? { details: error.details } : {})
      }
    };
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 400,
      body: { message: 'Uploaded image is too large.', code: 'UPLOAD_TOO_LARGE' }
    };
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return {
      statusCode: 400,
      body: { message: 'Too many uploaded files.', code: 'UPLOAD_TOO_MANY_FILES' }
    };
  }

  if (error.code === 'P2002') {
    return {
      statusCode: 409,
      body: { message: 'Username or email is already in use.', code: 'UNIQUE_CONSTRAINT' }
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      statusCode: 400,
      body: { message: 'Database request failed.', code: error.code || 'DATABASE_ERROR' }
    };
  }

  return {
    statusCode: 500,
    body: {
      message: 'Internal server error.',
      code: 'INTERNAL_ERROR',
      ...(config.isProduction ? {} : { details: error.message })
    }
  };
}

function notFound(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return next(new AppError(404, 'API route not found.', 'NOT_FOUND'));
  }
  next();
}

function errorHandler(error, req, res, next) {
  const { statusCode, body } = errorResponse(error);
  const log = req.log || logger;
  log[statusCode >= 500 ? 'error' : 'warn']({ err: error, code: body.code }, body.message);
  res.status(statusCode).json(body);
}

module.exports = { AppError, notFound, errorHandler };
