import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../../src/database/postgres.provider';

export interface CreateInvitationRepositoryDto {
  email: string;
  token: string;
  invitedBy: number;
  expiresAt: Date;
}

@Injectable()
export class InvitationsRepository {
  constructor(
    @Inject(POSTGRES_POOL)
    private readonly db: Pool,
  ) {}

  async create(invitation: CreateInvitationRepositoryDto) {
    const result = await this.db.query(
      `
      INSERT INTO invitations
      (
        email,
        token,
        
        invited_by,
        expires_at
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        invitation.email,
        invitation.token,
        
        invitation.invitedBy,
        invitation.expiresAt,
      ],
    );

    return result.rows[0];
  }

  async findByToken(token: string) {
    const result = await this.db.query(
      `
      SELECT *
      FROM invitations
      WHERE token = $1
      LIMIT 1
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  async findPendingByEmail(email: string) {
    const result = await this.db.query(
      `
      SELECT *
      FROM invitations
      WHERE email = $1
        AND accepted_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async markAccepted(id: number) {
    const result = await this.db.query(
      `
      UPDATE invitations
      SET accepted_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async deleteExpired() {
    await this.db.query(
      `
      DELETE FROM invitations
      WHERE expires_at < NOW()
      `,
    );
  }
}