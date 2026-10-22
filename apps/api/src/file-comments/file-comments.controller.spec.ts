import { Test, TestingModule } from '@nestjs/testing';
import { FileCommentsController } from './file-comments.controller';
import { FileCommentsService } from './file-comments.service';

const makeService = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  remove: jest.fn().mockResolvedValue({ ok: true }),
});

describe('FileCommentsController', () => {
  let controller: FileCommentsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileCommentsController],
      providers: [{ provide: FileCommentsService, useValue: service }],
    }).compile();

    controller = module.get(FileCommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll forwards fileId and user.id to service', async () => {
    await controller.findAll(10, { id: 7, systemRole: 'USER' } as any);
    expect(service.findAll).toHaveBeenCalledWith(10, 7);
  });

  it('create forwards fileId, user.id, and dto to service', async () => {
    const dto = { content: 'hello' };
    await controller.create(10, { id: 7, systemRole: 'USER' } as any, dto as any);
    expect(service.create).toHaveBeenCalledWith(10, 7, dto);
  });

  it('remove forwards fileId, commentId, and user.id to service', async () => {
    await controller.remove(10, 5, { id: 7, systemRole: 'USER' } as any);
    expect(service.remove).toHaveBeenCalledWith(10, 5, 7);
  });
});
