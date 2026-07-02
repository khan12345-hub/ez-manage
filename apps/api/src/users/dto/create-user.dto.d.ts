import { UserStatus } from '@shared/src';
export declare class CreateUserDto {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    status: UserStatus;
}
