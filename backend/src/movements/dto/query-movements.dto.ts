import { ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export class QueryMovementsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  type?: MovementType;

  @ApiPropertyOptional({ description: 'Inclusive lower bound, ISO date' })
  @IsOptional()
  @IsISO8601({}, { message: 'from must be an ISO date' })
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound, ISO date' })
  @IsOptional()
  @IsISO8601({}, { message: 'to must be an ISO date' })
  to?: string;
}
