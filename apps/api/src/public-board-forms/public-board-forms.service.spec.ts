import { Test, TestingModule } from '@nestjs/testing';
import { PublicBoardFormsService } from './public-board-forms.service';

describe('PublicBoardFormsService', () => {
  let service: PublicBoardFormsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicBoardFormsService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<PublicBoardFormsService>(PublicBoardFormsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
