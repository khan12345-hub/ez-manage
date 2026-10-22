import { Test, TestingModule } from '@nestjs/testing';
import { StatusOptionsController } from './status-options.controller';
import { StatusOptionsService } from './status-options.service';
import { SessionUser } from 'src/auth/types/session-user.type';

// Note: anonymous request rejection (HTTP 401) is enforced by the global
// SessionAuthGuard registered in AppModule — it applies to all routes
// including these five, but requires an e2e test context to verify.

describe('StatusOptionsController', () => {
  let controller: StatusOptionsController;

  const serviceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getUniqueLabelValues: jest.fn(),
  };

  const mockUser = { id: 5, systemRole: 'USER' } as unknown as SessionUser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusOptionsController],
      providers: [{ provide: StatusOptionsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<StatusOptionsController>(StatusOptionsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates columnId and user.id to service', async () => {
      serviceMock.findAll.mockResolvedValue([]);
      await controller.findAll(1, mockUser);
      expect(serviceMock.findAll).toHaveBeenCalledWith(1, mockUser.id);
    });
  });

  describe('getUniqueLabelValues', () => {
    it('delegates columnId and user.id to service', async () => {
      serviceMock.getUniqueLabelValues.mockResolvedValue([]);
      await controller.getUniqueLabelValues(1, mockUser);
      expect(serviceMock.getUniqueLabelValues).toHaveBeenCalledWith(1, mockUser.id);
    });
  });

  describe('create', () => {
    it('delegates columnId, dto, and user.id to service', async () => {
      const dto = { label: 'New', color: '#fff' } as any;
      serviceMock.create.mockResolvedValue({ id: 1, ...dto });
      await controller.create(1, dto, mockUser);
      expect(serviceMock.create).toHaveBeenCalledWith(1, dto, mockUser.id);
    });
  });

  describe('update', () => {
    it('delegates columnId, statusId, user.id, dto to service in correct order', async () => {
      const dto = { label: 'Updated' } as any;
      serviceMock.update.mockResolvedValue({ id: 100, label: 'Updated' });
      await controller.update(1, 100, dto, mockUser);
      expect(serviceMock.update).toHaveBeenCalledWith(1, 100, mockUser.id, dto);
    });
  });

  describe('remove', () => {
    it('delegates columnId, statusId, and user.id to service', async () => {
      serviceMock.remove.mockResolvedValue({ id: 100 });
      await controller.remove(1, 100, mockUser);
      expect(serviceMock.remove).toHaveBeenCalledWith(1, 100, mockUser.id);
    });
  });
});
