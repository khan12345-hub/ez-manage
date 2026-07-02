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
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const postgres_provider_1 = require("../../src/database/postgres.provider");
let AuthRepository = class AuthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findUserByEmail(email) {
        const { rows } = await this.db.query(`
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
      `, [email]);
        return rows[0] ?? null;
    }
    async findUserById(id) {
        const { rows } = await this.db.query(`
      SELECT
        id,
        organization_id AS "organizationId",
        first_name AS "firstName",
        last_name AS "lastName",
        email,
        role,
        status
      FROM users
      WHERE id = $1
      LIMIT 1
      `, [id]);
        return rows[0] ?? null;
    }
    async updateLastLogin(id) {
        await this.db.query(`
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = $1
      `, [id]);
    }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(postgres_provider_1.POSTGRES_POOL)),
    __metadata("design:paramtypes", [typeof (_a = typeof pg_1.Pool !== "undefined" && pg_1.Pool) === "function" ? _a : Object])
], AuthRepository);
//# sourceMappingURL=auth.repository.js.map