import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MovementRow } from '../common/api-types';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { MOVEMENT_INCLUDE, toMovementRow } from './movement.mapper';
import { validateMovementShape } from './movement-shape';

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one movement and applies it to the affected balances atomically.
   *
   * The debit is a single conditional UPDATE guarded by `qty >= :qty`. Because
   * the row is only touched when it has the stock, there is no read-then-write
   * window: two concurrent OUTs against the same balance cannot both succeed,
   * and a rejected draw leaves the stored quantity exactly as it was.
   *
   * On a TRANSFER the debit runs before the credit, so a failed withdrawal can
   * never leave phantom stock behind at the destination — the whole transaction
   * rolls back, audit row included.
   */
  async create(dto: CreateMovementDto, userId: string): Promise<MovementRow> {
    const shapeError = validateMovementShape(dto);
    if (shapeError) {
      throw badRequest(shapeError);
    }

    await this.assertReferencesExist(dto);

    const movement = await this.prisma.$transaction(async (tx) => {
      if (dto.type === 'OUT' || dto.type === 'TRANSFER') {
        await debit(tx, dto.itemId, dto.fromLocId as string, dto.qty);
      }
      if (dto.type === 'IN' || dto.type === 'TRANSFER') {
        await credit(tx, dto.itemId, dto.toLocId as string, dto.qty);
      }

      return tx.movement.create({
        data: {
          type: dto.type,
          itemId: dto.itemId,
          fromLocId: dto.fromLocId || null,
          toLocId: dto.toLocId || null,
          qty: dto.qty,
          note: dto.note?.trim() || null,
          userId,
        },
        include: MOVEMENT_INCLUDE,
      });
    });

    return toMovementRow(movement);
  }

  /** The audit log. Immutable — there is deliberately no update or delete. */
  async findAll(query: QueryMovementsDto): Promise<MovementRow[]> {
    const where: Prisma.MovementWhereInput = {
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const createdAt = dateRange(query.from, query.to);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const movements = await this.prisma.movement.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return movements.map(toMovementRow);
  }

  /**
   * Validated before the transaction opens so a bad id yields a 404 rather than
   * a foreign-key error surfacing as a 500.
   */
  private async assertReferencesExist(dto: CreateMovementDto): Promise<void> {
    const item = await this.prisma.item.count({ where: { id: dto.itemId } });
    if (item === 0) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    const locationIds = [dto.fromLocId, dto.toLocId].filter(
      (id): id is string => !!id,
    );
    if (locationIds.length === 0) {
      return;
    }
    const found = await this.prisma.location.count({
      where: { id: { in: locationIds } },
    });
    if (found !== new Set(locationIds).size) {
      throw new NotFoundException('One or more locations were not found');
    }
  }
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Conditional decrement. `qty >= :qty` in the WHERE clause is the *only* stock
 * check in the system; Postgres row-locks the balance for the duration of the
 * statement, so the guard and the write are one indivisible step.
 */
async function debit(
  tx: TransactionClient,
  itemId: string,
  locationId: string,
  qty: number,
): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "StockLevel"
       SET qty = qty - ${qty}, "updatedAt" = NOW()
     WHERE "itemId" = ${itemId}
       AND "locationId" = ${locationId}
       AND qty >= ${qty}
  `;
  if (affected === 0) {
    // No row, or not enough on hand — both mean the draw is not allowed.
    throw badRequest('Insufficient stock at the source location');
  }
}

/** Creates the balance row on first receipt, increments it thereafter. */
async function credit(
  tx: TransactionClient,
  itemId: string,
  locationId: string,
  qty: number,
): Promise<void> {
  await tx.stockLevel.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    create: { itemId, locationId, qty },
    update: { qty: { increment: qty } },
  });
}

/** `to` is treated as inclusive: a bare date covers that whole day. */
function dateRange(
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = new Date(from);
  }
  if (to) {
    const upper = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      upper.setUTCHours(23, 59, 59, 999);
    }
    filter.lte = upper;
  }
  return filter;
}

function badRequest(message: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: [message],
  });
}
