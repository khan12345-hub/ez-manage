import { Test, TestingModule } from '@nestjs/testing';
import { BoardTemplatesService } from './board-templates.service';

describe('BoardTemplatesService', () => {
  let service: BoardTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardTemplatesService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<BoardTemplatesService>(BoardTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
