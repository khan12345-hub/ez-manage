import { Test, TestingModule } from '@nestjs/testing';
import { GlobalSearchController } from './global-search.controller';
import { GlobalSearchService } from './global-search.service';

describe('GlobalSearchController', () => {
  let controller: GlobalSearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalSearchController],
      providers: [GlobalSearchService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<GlobalSearchController>(GlobalSearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
