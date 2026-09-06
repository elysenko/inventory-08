import { Module } from '@nestjs/common';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { RuntimeConfigService } from '../common/config/runtime-config.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, RuntimeConfigService],
  exports: [SettingsService, RuntimeConfigService],
})
export class AdminModule {}
