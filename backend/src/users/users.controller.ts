import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRow } from '../common/api-types';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'All accounts (manager only)' })
  findAll(): Promise<UserRow[]> {
    return this.users.findAll();
  }
}
