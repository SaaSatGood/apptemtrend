import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();
const server = await app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

// Graceful shutdown: fecha HTTP antes de matar conexões ativas.
async function shutdown(signal: string) {
  try {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, 'Error during shutdown');
  } finally {
    process.exit(0);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}

export { app, server };
