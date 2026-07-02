import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../../src/database/postgres.provider';

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(POSTGRES_POOL)
    private readonly db: Pool,
  ) {}

  async findUserByEmail(email: string) {
    const { rows } = await this.db.query(
      `
      SELECT
        id,
        first_name AS "firstName",
        last_name AS "lastName",
        email,
        password_hash AS "passwordHash",
        role,
        status
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );

    return rows[0] ?? null;
  }

  async findUserById(id: number) {
    const { rows } = await this.db.query(
      `
      SELECT
        id,
        first_name AS "firstName",
        last_name AS "lastName",
        email,
        role,
        status
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return rows[0] ?? null;
  }

  async updateLastLogin(id: number) {
    await this.db.query(
      `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = $1
      `,
      [id],
    );
  }
}