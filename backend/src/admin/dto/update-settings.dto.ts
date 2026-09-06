import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, ValidateNested } from 'class-validator';

export class SettingUpdateDto {
  @ApiProperty({ example: 'MINIO_BUCKET' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'stockroom-media' })
  @IsString()
  value!: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingUpdateDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SettingUpdateDto)
  settings!: SettingUpdateDto[];
}
