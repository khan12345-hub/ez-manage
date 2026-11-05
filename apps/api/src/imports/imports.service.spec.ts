import { Test, TestingModule } from '@nestjs/testing';
import { ImportsService } from './imports.service';

describe('ImportsService', () => {
  let service: ImportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportsService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<ImportsService>(ImportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
