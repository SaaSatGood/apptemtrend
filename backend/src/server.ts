import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();
const server = await app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

if (!env.GEMINI_API_KEY) {
  app.log.warn('GEMINI_API_KEY ausente: busca assistida usa fallback local e geração de Content Kit retorna 503 AI_UNAVAILABLE');
} else {
  app.log.info({ model: env.GEMINI_MODEL }, 'Gemini AI configurada');
}

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
