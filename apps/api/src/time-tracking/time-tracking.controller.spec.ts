// Mock the guard so the @UseGuards decorator resolves cleanly in unit tests
// (the .js guard file isn't processable by ts-jest without allowJs).
jest.mock('src/auth/guards/session.guard', () => ({
  SessionAuthGuard: class { canActivate() { return true; } },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  TimeTrackingController,
  TimeTrackingBoardController,
  TimeTrackingGlobalController,
} from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';

const makeService = () => ({
  getEntries: jest.fn().mockResolvedValue([]),
  startTimer: jest.fn().mockResolvedValue({ id: 1 }),
  stopTimer: jest.fn().mockResolvedValue({ id: 1 }),
  logManual: jest.fn().mockResolvedValue({ id: 1 }),
  deleteEntry: jest.fn().mockResolvedValue({ success: true }),
  getActiveTimer: jest.fn().mockResolvedValue(null),
  getBoardTimeSummary: jest.fn().mockResolvedValue({ totalMs: 0 }),
  exportTimeReport: jest.fn().mockResolvedValue({ csv: 'Task,User,Date,Hours,Note', filename: 'report.csv' }),
  getMyActiveTimer: jest.fn().mockResolvedValue(null),
  getPersonalTimesheet: jest.fn().mockResolvedValue({ rows: [] }),
});

const USER = { id: 7, systemRole: 'USER' } as any;

// ─── TimeTrackingController ──────────────────────────────────────────────────

describe('TimeTrackingController', () => {
  let controller: TimeTrackingController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeTrackingController],
      providers: [{ provide: TimeTrackingService, useValue: service }],
    }).compile();

    controller = module.get(TimeTrackingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getEntries forwards boardId, taskId, and user.id to service', async () => {
    await controller.getEntries(1, 10, USER);
    expect(service.getEntries).toHaveBeenCalledWith(1, 10, 7);
  });

  it('startTimer forwards boardId, taskId, user.id, and note to service', async () => {
    await controller.startTimer(1, 10, USER, { note: 'working' });
    expect(service.startTimer).toHaveBeenCalledWith(1, 10, 7, 'working');
  });

  it('stopTimer forwards boardId, taskId, and user.id to service', async () => {
    await controller.stopTimer(1, 10, USER);
    expect(service.stopTimer).toHaveBeenCalledWith(1, 10, 7);
  });

  it('logManual forwards boardId, taskId, user.id, durationMs, note, and parsed startedAt to service', async () => {
    const body = { durationMs: 3_600_000, note: 'pair', startedAt: '2026-10-20T09:00:00Z' };
    await controller.logManual(1, 10, USER, body);
    expect(service.logManual).toHaveBeenCalledWith(
      1, 10, 7, 3_600_000, 'pair', new Date('2026-10-20T09:00:00Z'),
    );
  });

  it('logManual passes undefined startedAt when not supplied', async () => {
    await controller.logManual(1, 10, USER, { durationMs: 3_600_000 });
    expect(service.logManual).toHaveBeenCalledWith(1, 10, 7, 3_600_000, undefined, undefined);
  });

  it('deleteEntry forwards boardId, taskId, entryId, and user.id to service', async () => {
    await controller.deleteEntry(1, 10, 5, USER);
    expect(service.deleteEntry).toHaveBeenCalledWith(1, 10, 5, 7);
  });

  it('getActiveTimer forwards taskId, user.id, and boardId to service', async () => {
    await controller.getActiveTimer(1, 10, USER);
    expect(service.getActiveTimer).toHaveBeenCalledWith(10, 7, 1);
  });
});

// ─── TimeTrackingBoardController ─────────────────────────────────────────────

describe('TimeTrackingBoardController', () => {
  let controller: TimeTrackingBoardController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeTrackingBoardController],
      providers: [{ provide: TimeTrackingService, useValue: service }],
    }).compile();

    controller = module.get(TimeTrackingBoardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getBoardTimeSummary forwards boardId and user.id to service', async () => {
    await controller.getBoardTimeSummary(1, USER);
    expect(service.getBoardTimeSummary).toHaveBeenCalledWith(1, 7);
  });

  it('exportTimeReport forwards boardId, user.id, and filter params to service', async () => {
    const res = { set: jest.fn() } as any;
    await controller.exportTimeReport(1, USER, '2026-10-01', '2026-10-20', '42', res);
    expect(service.exportTimeReport).toHaveBeenCalledWith(1, 7, {
      startDate: '2026-10-01',
      endDate: '2026-10-20',
      userId: 42,
    });
  });

  it('exportTimeReport passes undefined userId when query param is absent', async () => {
    const res = { set: jest.fn() } as any;
    await controller.exportTimeReport(1, USER, undefined, undefined, undefined, res);
    expect(service.exportTimeReport).toHaveBeenCalledWith(1, 7, {
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
    });
  });
});

// ─── TimeTrackingGlobalController ────────────────────────────────────────────

describe('TimeTrackingGlobalController', () => {
  let controller: TimeTrackingGlobalController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeTrackingGlobalController],
      providers: [{ provide: TimeTrackingService, useValue: service }],
    }).compile();

    controller = module.get(TimeTrackingGlobalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMyActiveTimer forwards user.id to service', async () => {
    await controller.getMyActiveTimer(USER);
    expect(service.getMyActiveTimer).toHaveBeenCalledWith(7);
  });

  it('getPersonalTimesheet forwards user.id, workspaceId, and weekStart to service', async () => {
    await controller.getPersonalTimesheet(USER, '3', '2026-10-13');
    expect(service.getPersonalTimesheet).toHaveBeenCalledWith(7, 3, '2026-10-13');
  });
});
