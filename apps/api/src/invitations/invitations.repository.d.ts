import { Pool } from 'pg';
export interface CreateInvitationRepositoryDto {
    email: string;
    token: string;
    invitedBy: number;
    expiresAt: Date;
}
export declare class InvitationsRepository {
    private readonly db;
    constructor(db: Pool);
    create(invitation: CreateInvitationRepositoryDto): Promise<any>;
    findByToken(token: string): Promise<any>;
    findPendingByEmail(email: string): Promise<any>;
    markAccepted(id: number): Promise<any>;
    deleteExpired(): Promise<void>;
}
