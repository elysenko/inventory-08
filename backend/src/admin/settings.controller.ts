import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingEntry } from '../common/api-types';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Service credentials, masked (admin only)' })
  list(): Promise<SettingEntry[]> {
    return this.settings.list();
  }

  @Put()
  @ApiOperation({ summary: 'Save credential overrides (admin only)' })
  update(@Body() dto: UpdateSettingsDto): Promise<SettingEntry[]> {
    return this.settings.update(dto.settings);
  }
}
