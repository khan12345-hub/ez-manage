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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const invitations_repository_1 = require("./invitations.repository");
const users_repository_1 = require("../users/users.repository");
let InvitationsService = class InvitationsService {
    invitationsRepository;
    usersRepository;
    constructor(invitationsRepository, usersRepository) {
        this.invitationsRepository = invitationsRepository;
        this.usersRepository = usersRepository;
    }
    async create(dto, invitedBy) {
        const existingUser = await this.usersRepository.findByEmail(dto.email);
        if (existingUser) {
            throw new common_1.BadRequestException('A user with this email already exists.');
        }
        const existingInvitation = await this.invitationsRepository.findPendingByEmail(dto.email);
        if (existingInvitation) {
            throw new common_1.BadRequestException('A pending invitation already exists.');
        }
        const token = (0, crypto_1.randomUUID)();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const invitation = await this.invitationsRepository.create({
            email: dto.email,
            token,
            invitedBy,
            expiresAt,
        });
        return invitation;
    }
    async validateInvitation(token) {
        const invitation = await this.invitationsRepository.findByToken(token);
        if (!invitation) {
            throw new common_1.NotFoundException('Invitation not found.');
        }
        if (invitation.accepted_at) {
            throw new common_1.BadRequestException('Invitation has already been accepted.');
        }
        if (new Date(invitation.expires_at) < new Date()) {
            throw new common_1.BadRequestException('Invitation has expired.');
        }
        return invitation;
    }
    async markAccepted(id) {
        return this.invitationsRepository.markAccepted(id);
    }
};
exports.InvitationsService = InvitationsService;
exports.InvitationsService = InvitationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [invitations_repository_1.InvitationsRepository,
        users_repository_1.UsersRepository])
], InvitationsService);
//# sourceMappingURL=invitations.service.js.map