import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import { postgresProvider } from '../database/postgres.provider';

let middleware: RequestHandler | null = null;

/**
 * The one express-session middleware for the app. HTTP (main.ts) and the chat
 * socket handshake both use it, so a socket is only ever the user whose
 * session cookie it carries — never a userId the browser claims.
 */
export function sessionMiddleware(): RequestHandler {
  if (middleware) return middleware;
  const PgSession = connectPgSimple(session);
  const isProd = process.env.NODE_ENV === 'production';
  const handler: RequestHandler = session({
    store: new PgSession({
      pool: postgresProvider.useFactory(),
      tableName: 'sessions',
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      pruneSessionInterval: 24 * 60 * 60, // prune expired sessions daily
    }),
    secret: process.env.SESSION_SECRET!,
    proxy: true,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: isProd ? '.ezify.pk' : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });
  middleware = handler;
  return handler;
}

/** Browser origins allowed to call the API (HTTP CORS) and open the chat socket. */
export function allowedOrigins(): string[] {
  return [process.env.FRONTEND_URL ?? 'http://localhost:3000', 'https://manage.ezify.pk'].filter(Boolean);
}
