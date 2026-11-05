import { Test, TestingModule } from '@nestjs/testing';
import { GlobalSearchService } from './global-search.service';

describe('GlobalSearchService', () => {
  let service: GlobalSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalSearchService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<GlobalSearchService>(GlobalSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
