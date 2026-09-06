import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { LowStockRow } from '../common/api-types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('low-stock')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Items at or below reorder level (manager only)' })
  lowStock(): Promise<LowStockRow[]> {
    return this.reports.lowStock();
  }
}
