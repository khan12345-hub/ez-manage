import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../../src/database/postgres.provider';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(POSTGRES_POOL)
    private readonly db: Pool,
  ) {}
  async findByEmail(email: string) {
    const result = this.db.query(
      `SELECT email FROM users WHERE email=$1 LIMIT 1`,
      [email],
    );
    return result.row[0] ?? null;
  }

  async create(user: CreateUserDto) {
    const result = await this.db.query(
      `INSERT INTO users(first_name,last_name,email,password,status) VALUES($1,$2,$3,$4,$5) RETURNING *`, [
        user.firstName,
        user.lastName,
        user.password,
        user.status,
      ],
    );

    return result.row[0]
  }
}
