import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ItemDetail, ItemRow, MovementRow } from '../common/api-types';
import { MOVEMENT_INCLUDE, toMovementRow } from '../movements/movement.mapper';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';

const ITEM_INCLUDE = {
  stockLevels: {
    select: {
      qty: true,
      locationId: true,
      location: { select: { name: true, zone: true } },
    },
  },
} satisfies Prisma.ItemInclude;

type ItemWithLevels = Prisma.ItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The catalogue. `totalQty` is summed from the item's StockLevel rows, so an
   * item with no rows at all reads as 0 rather than disappearing.
   */
  async findAll(query: QueryItemsDto): Promise<ItemRow[]> {
    const term = query.q?.trim();
    const where: Prisma.ItemWhereInput = term
      ? {
          OR: [
            { sku: { contains: term, mode: 'insensitive' } },
            { name: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {};

    const items = await this.prisma.item.findMany({
      where,
      include: ITEM_INCLUDE,
      orderBy: { sku: 'asc' },
    });

    const rows = items.map(toItemRow);
    return query.lowStock === 'true'
      ? rows.filter((row) => row.totalQty <= row.reorderAt)
      : rows;
  }

  /** The item plus its per-location breakdown, ordered by location name. */
  async findOne(id: string): Promise<ItemDetail> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: ITEM_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }

    return {
      ...toItemRow(item),
      levels: item.stockLevels
        .map((level) => ({
          locationId: level.locationId,
          locationName: level.location.name,
          zone: level.location.zone,
          qty: level.qty,
        }))
        .sort((a, b) => a.locationName.localeCompare(b.locationName)),
    };
  }

  /** Item-scoped audit history, shown on the item detail page's tab. */
  async findMovements(id: string): Promise<MovementRow[]> {
    await this.assertExists(id);
    const movements = await this.prisma.movement.findMany({
      where: { itemId: id },
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return movements.map(toMovementRow);
  }

  async create(dto: CreateItemDto): Promise<ItemRow> {
    const sku = dto.sku.trim();
    await this.assertSkuFree(sku);
    try {
      const item = await this.prisma.item.create({
        data: {
          sku,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          unit: dto.unit.trim(),
          reorderAt: dto.reorderAt,
        },
        include: ITEM_INCLUDE,
      });
      return toItemRow(item);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemRow> {
    await this.assertExists(id);
    const sku = dto.sku?.trim();
    if (sku) {
      await this.assertSkuFree(sku, id);
    }

    try {
      const item = await this.prisma.item.update({
        where: { id },
        data: {
          ...(sku ? { sku } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
          ...(dto.reorderAt !== undefined ? { reorderAt: dto.reorderAt } : {}),
        },
        include: ITEM_INCLUDE,
      });
      return toItemRow(item);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  /**
   * Deleting an item that movements reference would tear a hole in the audit
   * trail, so that is refused rather than cascaded.
   */
  async remove(id: string): Promise<{ id: string }> {
    await this.assertExists(id);
    const movements = await this.prisma.movement.count({ where: { itemId: id } });
    if (movements > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [
          `item has ${movements} movement${movements === 1 ? '' : 's'} in the audit log and cannot be deleted`,
        ],
      });
    }
    await this.prisma.item.delete({ where: { id } });
    return { id };
  }

  private async assertExists(id: string): Promise<void> {
    const found = await this.prisma.item.count({ where: { id } });
    if (found === 0) {
      throw new NotFoundException(`Item ${id} not found`);
    }
  }

  /** Pre-check for a friendly, field-addressable 400 on the `sku` control. */
  private async assertSkuFree(sku: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.item.findUnique({ where: { sku } });
    if (existing && existing.id !== exceptId) {
      throw skuTaken();
    }
  }

  /** Closes the race between the pre-check and the write. */
  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return skuTaken();
    }
    return error;
  }
}

function skuTaken(): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: ['sku must be unique'],
  });
}

function toItemRow(item: ItemWithLevels): ItemRow {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    unit: item.unit,
    reorderAt: item.reorderAt,
    totalQty: item.stockLevels.reduce((sum, level) => sum + level.qty, 0),
  };
}
