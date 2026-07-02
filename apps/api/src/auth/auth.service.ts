// auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express-session';
import { LoginDto } from './dto/login.dto';
import { AuthRepository } from './auth.repository';
import { UserStatus } from '@shared/src';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async login(dto: LoginDto, req: Request) {
    // 1. Find user
    const user = await this.authRepository.findUserByEmail(dto.email);

    // 2. User not found
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Verify password
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 4. Check account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account is inactive. Please contact your administrator.',
      );
    }

    // 5. Create session
    req.session.user = {
      id: user.id,
      role: user.role,
    };

    // Optional but recommended
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    console.log(req.session);

    // 6. Remove password hash before returning
    const { passwordHash, ...safeUser } = user;

    return {
      message: 'Login successful.',
      user: safeUser,
    };
  }

  // auth.service.ts

  async me(req: Request) {
    console.log('req.session.user', req.session.cookie);
    // Not logged in
    if (!req.session?.user) {
      throw new UnauthorizedException();
    }

    const user = await this.authRepository.findUserById(req.session.user.id);

    // User deleted
    if (!user) {
      throw new UnauthorizedException();
    }

    // User disabled after login
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Your account is inactive.');
    }

    const { passwordHash, ...safeUser } = user;

    return {
      user: safeUser,
    };
  }
}
