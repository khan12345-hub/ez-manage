"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgresProvider = exports.POSTGRES_POOL = void 0;
const pg_1 = require("pg");
exports.POSTGRES_POOL = 'POSTGRES_POOL';
exports.postgresProvider = {
    provide: exports.POSTGRES_POOL,
    useFactory: () => {
        return new pg_1.Pool({
            host: process.env.DATABASE_HOST,
            port: Number(process.env.DATABASE_PORT),
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
        });
    },
};
//# sourceMappingURL=postgres.provider.js.map