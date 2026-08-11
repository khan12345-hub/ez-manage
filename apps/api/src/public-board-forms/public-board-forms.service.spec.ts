import { Test, TestingModule } from '@nestjs/testing';
import { PublicBoardFormsService } from './public-board-forms.service';

describe('PublicBoardFormsService', () => {
  let service: PublicBoardFormsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicBoardFormsService],
    }).compile();

    service = module.get<PublicBoardFormsService>(PublicBoardFormsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
