import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import * as dotenv from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import * as express from 'express';

import { AppModule } from './app.module';
import { postgresProvider } from './database/postgres.provider';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── Helmet: HTTP security headers ──────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: false, // disabled — API only, no HTML served
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    'https://manage.ezify.pk',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        if (isProd) {
          return callback(new Error('Direct API access is not allowed'), false);
        }
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Cookies
  app.use(cookieParser());

  // ── Session (must be before the /uploads auth guard) ───────────────────────
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool: postgresProvider.useFactory(),
        tableName: 'sessions',
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production'
          ? 'none'
          : 'lax',
      },
    }),
  );

  // ── Authenticated static file serving ──────────────────────────────────────
  // Require a valid session before serving any uploaded file.
  // express.static() itself is safe against path traversal by default.
  app.use('/uploads', (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    next();
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Request body limits
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  await app.listen(process.env.PORT ?? 3010);
}

bootstrap();
