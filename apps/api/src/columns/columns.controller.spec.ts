// Mock the guard so the @UseGuards decorator resolves cleanly in unit tests
// (the .js guard file isn't processable by ts-jest without allowJs).
jest.mock('src/auth/guards/session.guard', () => ({
  SessionAuthGuard: class { canActivate() { return true; } },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ColumnsController } from './columns.controller';
import { ColumnsService } from './columns.service';

const makeService = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockReturnValue('all'),
  findOne: jest.fn().mockReturnValue('one'),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  reorder: jest.fn().mockResolvedValue({ message: 'Columns reordered successfully' }),
  remove: jest.fn().mockResolvedValue({ message: 'Column deleted successfully.' }),
});

const USER = { id: 7, systemRole: 'USER' } as any;

describe('ColumnsController', () => {
  let controller: ColumnsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ColumnsController],
      providers: [{ provide: ColumnsService, useValue: service }],
    }).compile();

    controller = module.get(ColumnsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create forwards dto and user.id to service', async () => {
    const dto = { boardId: 5, type: 'STATUS' } as any;
    await controller.create(dto, USER);
    expect(service.create).toHaveBeenCalledWith(dto, 7);
  });

  it('update forwards id, dto, and user.id to service', async () => {
    const dto = { name: 'Renamed' };
    await controller.update(1, dto, USER);
    expect(service.update).toHaveBeenCalledWith(1, dto, 7);
  });

  it('reorder forwards dto and user.id to service', async () => {
    const dto = { boardId: 5, columnId: 1, previousColumnId: null, nextColumnId: 3 } as any;
    await controller.reorder(dto, USER);
    expect(service.reorder).toHaveBeenCalledWith(dto, 7);
  });

  it('remove forwards id and user.id to service', async () => {
    await controller.remove(1, USER);
    expect(service.remove).toHaveBeenCalledWith(1, 7);
  });

  it('findAll delegates to service with no user context (read-only stub)', () => {
    controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne delegates to service with column id', () => {
    controller.findOne(42);
    expect(service.findOne).toHaveBeenCalledWith(42);
  });
});
