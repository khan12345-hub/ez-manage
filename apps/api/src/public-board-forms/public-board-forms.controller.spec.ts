import { Test, TestingModule } from '@nestjs/testing';
import { PublicBoardFormsController } from './public-board-forms.controller';
import { PublicBoardFormsService } from './public-board-forms.service';

describe('PublicBoardFormsController', () => {
  let controller: PublicBoardFormsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicBoardFormsController],
      providers: [PublicBoardFormsService],
    }).compile();

    controller = module.get<PublicBoardFormsController>(PublicBoardFormsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
