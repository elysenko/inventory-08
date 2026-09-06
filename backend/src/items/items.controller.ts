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

import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { ItemDetail, ItemRow, MovementRow } from '../common/api-types';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'Catalogue with on-hand totals (any signed-in user)' })
  findAll(@Query() query: QueryItemsDto): Promise<ItemRow[]> {
    return this.items.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One item with its per-location balances' })
  findOne(@Param('id') id: string): Promise<ItemDetail> {
    return this.items.findOne(id);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Audit history for one item' })
  findMovements(@Param('id') id: string): Promise<MovementRow[]> {
    return this.items.findMovements(id);
  }

  @Post()
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Create an item (manager only)' })
  create(@Body() dto: CreateItemDto): Promise<ItemRow> {
    return this.items.create(dto);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Update an item (manager only)' })
  update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemRow> {
    return this.items.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Delete an item with no movement history' })
  remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.items.remove(id);
  }
}
