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
exports.UsersRepository = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const postgres_provider_1 = require("../../src/database/postgres.provider");
let UsersRepository = class UsersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findByEmail(email) {
        const result = this.db.query(`SELECT email FROM users WHERE email=$1 LIMIT 1`, [email]);
        return result.row[0] ?? null;
    }
    async create(user) {
        const result = await this.db.query(`INSERT INTO users(first_name,last_name,email,password,status) VALUES($1,$2,$3,$4,$5) RETURNING *`, [
            user.firstName,
            user.lastName,
            user.password,
            user.status,
        ]);
        return result.row[0];
    }
};
exports.UsersRepository = UsersRepository;
exports.UsersRepository = UsersRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(postgres_provider_1.POSTGRES_POOL)),
    __metadata("design:paramtypes", [typeof (_a = typeof pg_1.Pool !== "undefined" && pg_1.Pool) === "function" ? _a : Object])
], UsersRepository);
//# sourceMappingURL=users.repository.js.map