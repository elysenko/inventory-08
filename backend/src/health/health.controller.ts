import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up and serving. No dependencies touched. */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness: proves the database round-trips. Answers 503 rather than
   * throwing so the probe reads a status code instead of a stack trace.
   */
  @Get('deep')
  @ApiOperation({ summary: 'Readiness probe — verifies the database' })
  async deep(@Res() res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({ status: 'ok', database: 'up' });
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'down',
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
