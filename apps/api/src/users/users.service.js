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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const users_repository_1 = require("./users.repository");
const bcrypt_1 = require("bcrypt");
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async create(dto) {
        const existing = await this.usersRepository.findByEmail(dto.email);
        if (existing) {
            throw new common_1.ConflictException('Email already exists');
        }
        const hashedPassword = await bcrypt_1.bcrypt.hash(dto.password, 10);
        const user = await this.usersRepository.create({
            ...dto,
            password: hashedPassword,
        });
        return {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            status: user.status,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository])
], UsersService);
//# sourceMappingURL=users.service.js.map