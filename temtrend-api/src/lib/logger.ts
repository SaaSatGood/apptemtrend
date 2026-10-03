import pino from 'pino';
import { env } from '../config/env.js';

const level = env.NODE_ENV === 'test'
  ? 'silent'
  : env.NODE_ENV === 'production'
    ? 'info'
    : 'debug';

export const logger = pino({
  level,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.service_role',
      'body.access_token',
      'body.refresh_token',
      'body.client_secret',
      'body.api_key',
      'body.apiKey',
      '*.api_key',
      '*.apiKey',
      '*.access_token',
      '*.refresh_token',
      '*.client_secret',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
