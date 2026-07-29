import { Test, TestingModule } from '@nestjs/testing';
import { StatusOptionsController } from './status-options.controller';
import { StatusOptionsService } from './status-options.service';

describe('StatusOptionsController', () => {
  let controller: StatusOptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusOptionsController],
      providers: [StatusOptionsService],
    }).compile();

    controller = module.get<StatusOptionsController>(StatusOptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
