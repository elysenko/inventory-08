import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { LowStockRow } from '../common/api-types';

interface LowStockQueryRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorderAt: number;
  totalQty: bigint | number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Items at or below their reorder threshold, worst deficit first.
   *
   * The LEFT JOIN matters: an item with no StockLevel rows at all has no stock
   * anywhere, which is the most urgent case — an INNER JOIN would hide exactly
   * the items that most need reordering.
   */
  async lowStock(): Promise<LowStockRow[]> {
    const rows = await this.prisma.$queryRaw<LowStockQueryRow[]>`
      SELECT i.id,
             i.sku,
             i.name,
             i.unit,
             i."reorderAt",
             COALESCE(SUM(s.qty), 0) AS "totalQty"
        FROM "Item" i
        LEFT JOIN "StockLevel" s ON s."itemId" = i.id
       GROUP BY i.id
      HAVING COALESCE(SUM(s.qty), 0) <= i."reorderAt"
       ORDER BY (COALESCE(SUM(s.qty), 0) - i."reorderAt") ASC, i.sku ASC
    `;

    return rows.map((row) => {
      // SUM() comes back as bigint over the wire; JSON cannot carry it.
      const totalQty = Number(row.totalQty);
      return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        reorderAt: row.reorderAt,
        totalQty,
        deficit: row.reorderAt - totalQty,
      };
    });
  }
}
