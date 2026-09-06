import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MovementRow } from '../common/api-types';

@ApiTags('movements')
@ApiBearerAuth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a stock movement — clerks and managers alike',
  })
  create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MovementRow> {
    return this.movements.create(dto, user.id);
  }

  @Get()
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Audit log, newest first (manager only)' })
  findAll(@Query() query: QueryMovementsDto): Promise<MovementRow[]> {
    return this.movements.findAll(query);
  }
}
