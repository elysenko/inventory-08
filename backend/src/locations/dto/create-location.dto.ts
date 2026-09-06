import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Bulk Racking A1' })
  @IsString()
  @MinLength(1, { message: 'name is required' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Zone A' })
  @IsString()
  @MinLength(1, { message: 'zone is required' })
  @MaxLength(120)
  zone!: string;
}
