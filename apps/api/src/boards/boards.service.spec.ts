import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service';

describe('BoardsService', () => {
  let service: BoardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardsService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<BoardsService>(BoardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
