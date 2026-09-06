import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMovementDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  type!: MovementType;

  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'qty must be a whole number' })
  @Min(1, { message: 'qty must be at least 1' })
  qty!: number;

  @ApiPropertyOptional({ description: 'Required for OUT and TRANSFER' })
  @IsOptional()
  @IsString()
  fromLocId?: string;

  @ApiPropertyOptional({ description: 'Required for IN and TRANSFER' })
  @IsOptional()
  @IsString()
  toLocId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
