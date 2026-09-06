import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const BCRYPT_ROUNDS = 10;

/** The `AuthResponse` shape the Angular AuthService stores in localStorage. */
export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Self-service registration. The very first account in an empty database
   * becomes a MANAGER so a fresh install is usable; every later signup is a
   * clerk (USER). Platform-minted logins are created by prisma/seed/seed.js and
   * always exist before real signups, so this path yields clerks in practice.
   */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const email = normaliseEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: ['email is already registered'],
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = (await this.prisma.user.count()) === 0 ? Role.MANAGER : Role.USER;

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash, role, name: dto.name?.trim() || null },
      });
      return this.issue(user);
    } catch (error) {
      // Closes the race between the pre-check above and the insert.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: ['email is already registered'],
        });
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: normaliseEmail(dto.email) },
    });
    // Compare unconditionally-shaped work either way: a missing user and a bad
    // password return the same message so the endpoint is not an email oracle.
    const valid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issue(user);
  }

  private async issue(user: User): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
