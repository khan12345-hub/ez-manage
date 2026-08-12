import { Test, TestingModule } from '@nestjs/testing';
import { BoardTemplatesController } from './board-templates.controller';
import { BoardTemplatesService } from './board-templates.service';

describe('BoardTemplatesController', () => {
  let controller: BoardTemplatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardTemplatesController],
      providers: [BoardTemplatesService],
    }).compile();

    controller = module.get<BoardTemplatesController>(BoardTemplatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
