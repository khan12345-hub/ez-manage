import { Request } from 'express-session';
import { LoginDto } from './dto/login.dto';
import { AuthRepository } from './auth.repository';
export declare class AuthService {
    private readonly authRepository;
    constructor(authRepository: AuthRepository);
    login(dto: LoginDto, req: Request): Promise<{
        message: string;
        user: any;
    }>;
}
