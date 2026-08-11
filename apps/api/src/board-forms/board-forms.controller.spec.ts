import { Test, TestingModule } from '@nestjs/testing';
import { BoardFormsController } from './board-forms.controller';
import { BoardFormsService } from './board-forms.service';

describe('BoardFormsController', () => {
  let controller: BoardFormsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardFormsController],
      providers: [BoardFormsService],
    }).compile();

    controller = module.get<BoardFormsController>(BoardFormsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
