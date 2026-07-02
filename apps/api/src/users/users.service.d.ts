import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: UsersRepository);
    create(dto: CreateUserDto): Promise<{
        id: any;
        firstName: any;
        lastName: any;
        email: any;
        status: any;
    }>;
}
