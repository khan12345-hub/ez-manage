import { Test, TestingModule } from '@nestjs/testing';
import { StatusOptionsService } from './status-options.service';

describe('StatusOptionsService', () => {
  let service: StatusOptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StatusOptionsService],
    }).compile();

    service = module.get<StatusOptionsService>(StatusOptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
