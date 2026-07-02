"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationsRepository = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const postgres_provider_1 = require("../../src/database/postgres.provider");
let InvitationsRepository = class InvitationsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(invitation) {
        const result = await this.db.query(`
      INSERT INTO invitations
      (
        email,
        token,
        
        invited_by,
        expires_at
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `, [
            invitation.email,
            invitation.token,
            invitation.invitedBy,
            invitation.expiresAt,
        ]);
        return result.rows[0];
    }
    async findByToken(token) {
        const result = await this.db.query(`
      SELECT *
      FROM invitations
      WHERE token = $1
      LIMIT 1
      `, [token]);
        return result.rows[0] ?? null;
    }
    async findPendingByEmail(email) {
        const result = await this.db.query(`
      SELECT *
      FROM invitations
      WHERE email = $1
        AND accepted_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `, [email]);
        return result.rows[0] ?? null;
    }
    async markAccepted(id) {
        const result = await this.db.query(`
      UPDATE invitations
      SET accepted_at = NOW()
      WHERE id = $1
      RETURNING *
      `, [id]);
        return result.rows[0] ?? null;
    }
    async deleteExpired() {
        await this.db.query(`
      DELETE FROM invitations
      WHERE expires_at < NOW()
      `);
    }
};
exports.InvitationsRepository = InvitationsRepository;
exports.InvitationsRepository = InvitationsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(postgres_provider_1.POSTGRES_POOL)),
    __metadata("design:paramtypes", [typeof (_a = typeof pg_1.Pool !== "undefined" && pg_1.Pool) === "function" ? _a : Object])
], InvitationsRepository);
//# sourceMappingURL=invitations.repository.js.map