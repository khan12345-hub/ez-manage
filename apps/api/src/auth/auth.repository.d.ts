import { Pool } from 'pg';
export declare class AuthRepository {
    private readonly db;
    constructor(db: Pool);
    findUserByEmail(email: string): Promise<any>;
    findUserById(id: number): Promise<any>;
    updateLastLogin(id: number): Promise<void>;
}
