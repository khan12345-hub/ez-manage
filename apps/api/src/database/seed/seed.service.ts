// src/database/seed.service.ts

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { POSTGRES_POOL } from '../postgres.provider';
import { UserStatus } from '@shared/src';

@Injectable()
export class SeedService {
  constructor(
    @Inject(POSTGRES_POOL)
    private readonly pool: Pool,
  ) {}

  async seed() {
    const client = await this.pool.connect();
    console.log("process.env.DEFAULT_OWNER_PASSWORD", process.env.DEFAULT_OWNER_PASSWORD)
    try {
      await client.query('BEGIN');

      // Check if owner already exists
      const existingOwner = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [process.env.DEFAULT_OWNER_EMAIL],
      );

      if (existingOwner.rowCount) {
        console.log('Owner already exists.');
        await client.query('ROLLBACK');
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(
        process.env.DEFAULT_OWNER_PASSWORD!,
        12,
      );

      console.log("password", passwordHash)

      // Create owner
      await client.query(
        `
        INSERT INTO users
        (
          
          first_name,
          last_name,
          email,
          password_hash,
          role,
          status
        )
        VALUES ($1,$2,$3,$4,$5, $6)
        `,
        [
          
          process.env.DEFAULT_OWNER_FIRST_NAME,
          process.env.DEFAULT_OWNER_LAST_NAME,
          process.env.DEFAULT_OWNER_EMAIL,
          passwordHash,
          'OWNER',
          UserStatus.ACTIVE,
        ],
      );

      await client.query('COMMIT');

      console.log('Database seeded successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}