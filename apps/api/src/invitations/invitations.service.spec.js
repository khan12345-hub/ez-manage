"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const invitations_service_1 = require("./invitations.service");
describe('InvitationsService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [invitations_service_1.InvitationsService],
        }).compile();
        service = module.get(invitations_service_1.InvitationsService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=invitations.service.spec.js.map