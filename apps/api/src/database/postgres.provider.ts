import { Global } from '@nestjs/common';
import { Pool } from 'pg';

export const POSTGRES_POOL = 'POSTGRES_POOL';

export const postgresProvider = {
  provide: POSTGRES_POOL,
  useFactory: () => {
    return new Pool({
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    });
  },
};
