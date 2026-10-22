// Mock transitive dependencies that cannot be resolved in the unit-test environment.
// auth.controller imports AuthService, which imports @shared enums not in jest's module map.
jest.mock('./auth.service', () => ({
  AuthService: class AuthService {
    login = jest.fn();
    me = jest.fn();
    logout = jest.fn();
    changePassword = jest.fn();
    setupAccount = jest.fn();
    forgotPassword = jest.fn();
    resetPassword = jest.fn();
    getInvitationDetails = jest.fn();
    setUserStatus = jest.fn().mockResolvedValue({ chatStatusEmoji: null, chatStatusText: null });
  },
}));
jest.mock('src/chat/chat.gateway', () => ({
  ChatGateway: class ChatGateway {
    broadcastUserStatus = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChatGateway } from 'src/chat/chat.gateway';

// NOTE: These tests verify that the correct @Throttle and @Public metadata
// is set on each handler at class-definition time.  They do NOT prove that
// ThrottlerGuard enforces the limits on live HTTP requests — that requires
// an integration/e2e test with a real HTTP adapter.

const THROTTLER_TTL_KEY = 'THROTTLER:TTLauth';
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMITauth';
const IS_PUBLIC_KEY = 'isPublic';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useClass: AuthService },
        { provide: ChatGateway, useClass: ChatGateway },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── Throttle metadata ─────────────────────────────────────────────────────

  describe('rate-limit metadata', () => {
    it('login has auth throttle: limit=5, ttl=60000', () => {
      const h = AuthController.prototype.login;
      expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, h)).toBe(5);
      expect(Reflect.getMetadata(THROTTLER_TTL_KEY, h)).toBe(60_000);
    });

    it('forgot-password has auth throttle: limit=5, ttl=60000', () => {
      const h = AuthController.prototype.forgotPassword;
      expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, h)).toBe(5);
      expect(Reflect.getMetadata(THROTTLER_TTL_KEY, h)).toBe(60_000);
    });

    it('reset-password has auth throttle: limit=5, ttl=60000', () => {
      const h = AuthController.prototype.resetPassword;
      expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, h)).toBe(5);
      expect(Reflect.getMetadata(THROTTLER_TTL_KEY, h)).toBe(60_000);
    });

    it('change-password does NOT have auth throttle (authenticated route)', () => {
      const h = AuthController.prototype.changePassword;
      expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, h)).toBeUndefined();
    });

    it('all three public auth routes share the same limit (5) and ttl (60000)', () => {
      const handlers = [
        AuthController.prototype.login,
        AuthController.prototype.forgotPassword,
        AuthController.prototype.resetPassword,
      ];
      for (const h of handlers) {
        expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, h)).toBe(5);
        expect(Reflect.getMetadata(THROTTLER_TTL_KEY, h)).toBe(60_000);
      }
    });
  });

  // ─── @Public metadata ──────────────────────────────────────────────────────

  describe('@Public decorator', () => {
    it('login is public', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login)).toBe(true);
    });

    it('forgot-password is public', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.forgotPassword)).toBe(true);
    });

    it('reset-password is still public after adding @Throttle', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.resetPassword)).toBe(true);
    });

    it('change-password is NOT public (requires session)', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.changePassword)).toBeUndefined();
    });
  });

  // ─── Route delegation ──────────────────────────────────────────────────────

  describe('route delegation', () => {
    it('resetPassword delegates to authService.resetPassword with the DTO', async () => {
      service.resetPassword.mockResolvedValue({ success: true });
      const dto = { token: 'tok', password: 'NewPass1!' } as any;
      await controller.resetPassword(dto);
      expect(service.resetPassword).toHaveBeenCalledWith(dto);
    });

    it('forgotPassword delegates to authService.forgotPassword', async () => {
      service.forgotPassword.mockResolvedValue({});
      const dto = { email: 'a@b.com' } as any;
      await controller.forgotPassword(dto);
      expect(service.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });
});
