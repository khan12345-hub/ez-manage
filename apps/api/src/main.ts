import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { postgresProvider } from './database/postgres.provider';
import cookieParser from "cookie-parser";
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(cookieParser());

  app.useStaticAssets(
    join(
      process.cwd(),
      'uploads',
    ),
    {
      prefix: '/uploads/',
    },
  );

  app.enableCors({
    origin: "http://localhost:3000", // Next.js frontend
    credentials: true, // Required for cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.setGlobalPrefix('api');
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
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
