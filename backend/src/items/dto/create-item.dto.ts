import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'WH-1001', description: 'Letters, digits and dashes' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'sku may only contain letters, digits and dashes',
  })
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'M8 Hex Bolt, Zinc Plated' })
  @IsString()
  @MinLength(1, { message: 'name is required' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'ea' })
  @IsString()
  @MinLength(1, { message: 'unit is required' })
  @MaxLength(32)
  unit!: string;

  @ApiProperty({ example: 120, description: 'Low-stock threshold' })
  @IsInt({ message: 'reorderAt must be a whole number' })
  @Min(0, { message: 'reorderAt must be zero or greater' })
  reorderAt!: number;
}
