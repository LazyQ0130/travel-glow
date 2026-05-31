function startServer(app, options = {}) {
  const {
    config,
    logger,
    prisma,
    port = config.port,
    registerSignals = true,
    exit = process.exit
  } = options;

  const server = app.listen(port, () => {
    logger.info(`Travel Glow running at http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        { port, error: { code: error.code, message: error.message } },
        `Port ${port} is already in use. Stop the existing process or set PORT to another value.`
      );
      exit(1);
      return;
    }

    logger.error({ error }, 'Failed to start Travel Glow.');
    exit(1);
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutting down.');
    server.close(async (error) => {
      if (error) {
        logger.error({ error }, 'Server shutdown failed.');
        exit(1);
        return;
      }

      await prisma.$disconnect();
      logger.info('Shutdown complete.');
      exit(0);
    });
  }

  if (registerSignals) {
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  return server;
}

module.exports = { startServer };
