"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const invitations_controller_1 = require("./invitations.controller");
const invitations_service_1 = require("./invitations.service");
describe('InvitationsController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [invitations_controller_1.InvitationsController],
            providers: [invitations_service_1.InvitationsService],
        }).compile();
        controller = module.get(invitations_controller_1.InvitationsController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
//# sourceMappingURL=invitations.controller.spec.js.map