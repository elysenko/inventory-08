import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UserRow } from '../common/api-types';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Never selects passwordHash — the hash has no reason to leave the service. */
  async findAll(): Promise<UserRow[]> {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  }
}
