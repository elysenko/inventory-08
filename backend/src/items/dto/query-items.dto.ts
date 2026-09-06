import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryItemsDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on sku or name' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({ description: "'true' restricts to totalQty <= reorderAt" })
  @IsOptional()
  @IsBooleanString()
  lowStock?: string;
}
