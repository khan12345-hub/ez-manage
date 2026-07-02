import { Pool } from 'pg';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersRepository {
    private readonly db;
    constructor(db: Pool);
    findByEmail(email: string): Promise<any>;
    create(user: CreateUserDto): Promise<any>;
}
