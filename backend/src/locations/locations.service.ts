import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { LocationRow, StockLevelRow } from '../common/api-types';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Readable by every signed-in user — clerks pick locations when recording. */
  async findAll(): Promise<LocationRow[]> {
    const locations = await this.prisma.location.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, zone: true },
    });
    return locations;
  }

  async findOne(id: string): Promise<LocationRow> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, zone: true },
    });
    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }
    return location;
  }

  /**
   * The flat balance feed the movement wizard uses to show available quantity
   * per source location without fetching each item one at a time.
   */
  async findStockLevels(itemId?: string): Promise<StockLevelRow[]> {
    const levels = await this.prisma.stockLevel.findMany({
      where: itemId ? { itemId } : {},
      include: { location: { select: { name: true, zone: true } } },
      orderBy: [{ itemId: 'asc' }],
    });
    return levels
      .map((level) => ({
        itemId: level.itemId,
        locationId: level.locationId,
        locationName: level.location.name,
        zone: level.location.zone,
        qty: level.qty,
      }))
      .sort((a, b) => a.locationName.localeCompare(b.locationName));
  }

  async create(dto: CreateLocationDto): Promise<LocationRow> {
    const name = dto.name.trim();
    await this.assertNameFree(name);
    try {
      return await this.prisma.location.create({
        data: { name, zone: dto.zone.trim() },
        select: { id: true, name: true, zone: true },
      });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationRow> {
    await this.findOne(id);
    const name = dto.name?.trim();
    if (name) {
      await this.assertNameFree(name, id);
    }
    try {
      return await this.prisma.location.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(dto.zone !== undefined ? { zone: dto.zone.trim() } : {}),
        },
        select: { id: true, name: true, zone: true },
      });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  /**
   * Refuses while stock is still on hand there, or while any movement points at
   * it — deleting either would silently destroy quantity or audit history.
   */
  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);

    const onHand = await this.prisma.stockLevel.aggregate({
      where: { locationId: id },
      _sum: { qty: true },
    });
    if ((onHand._sum.qty ?? 0) > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [
          `location still holds ${onHand._sum.qty} unit(s) of stock and cannot be deleted`,
        ],
      });
    }

    const movements = await this.prisma.movement.count({
      where: { OR: [{ fromLocId: id }, { toLocId: id }] },
    });
    if (movements > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [
          `location appears on ${movements} movement${movements === 1 ? '' : 's'} in the audit log and cannot be deleted`,
        ],
      });
    }

    await this.prisma.location.delete({ where: { id } });
    return { id };
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.location.findUnique({ where: { name } });
    if (existing && existing.id !== exceptId) {
      throw nameTaken();
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return nameTaken();
    }
    return error;
  }
}

function nameTaken(): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: ['name must be unique'],
  });
}
