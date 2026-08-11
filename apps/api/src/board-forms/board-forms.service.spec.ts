import { Test, TestingModule } from '@nestjs/testing';
import { BoardFormsService } from './board-forms.service';

describe('BoardFormsService', () => {
  let service: BoardFormsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardFormsService],
    }).compile();

    service = module.get<BoardFormsService>(BoardFormsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
