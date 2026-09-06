import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { LocationRow, StockLevelRow } from '../common/api-types';

@ApiTags('locations')
@ApiBearerAuth()
@Controller()
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('locations')
  @ApiOperation({ summary: 'All storage locations (any signed-in user)' })
  findAll(): Promise<LocationRow[]> {
    return this.locations.findAll();
  }

  @Get('stock-levels')
  @ApiOperation({ summary: 'Flat per-item, per-location balance feed' })
  findStockLevels(@Query('itemId') itemId?: string): Promise<StockLevelRow[]> {
    return this.locations.findStockLevels(itemId);
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'One location' })
  findOne(@Param('id') id: string): Promise<LocationRow> {
    return this.locations.findOne(id);
  }

  @Post('locations')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Create a location (manager only)' })
  create(@Body() dto: CreateLocationDto): Promise<LocationRow> {
    return this.locations.create(dto);
  }

  @Patch('locations/:id')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Update a location (manager only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationRow> {
    return this.locations.update(id, dto);
  }

  @Delete('locations/:id')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Delete an empty, unreferenced location' })
  remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.locations.remove(id);
  }
}
