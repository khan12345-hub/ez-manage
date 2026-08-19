import { Test, TestingModule } from '@nestjs/testing';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';

describe('AutomationsController', () => {
  let controller: AutomationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [AutomationsService],
    }).compile();

    controller = module.get<AutomationsController>(AutomationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
