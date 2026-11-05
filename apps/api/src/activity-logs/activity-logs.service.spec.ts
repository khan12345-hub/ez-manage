import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogsService } from './activity-logs.service';

describe('ActivityLogsService', () => {
  let service: ActivityLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityLogsService],
    })
      // Auto-mock every dependency these smoke tests do not care about.
      .useMocker(() => ({}))
      .compile();

    service = module.get<ActivityLogsService>(ActivityLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
