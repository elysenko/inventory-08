import { MovementType, Role } from '@prisma/client';

/**
 * Wire shapes for /api. These mirror frontend/src/app/core/models.ts field for
 * field — the Angular components type their signals against that file, so any
 * drift here shows up as a compile error there rather than an empty table.
 */

export interface ItemRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  /** SUM of every StockLevel for this item, across all locations. */
  totalQty: number;
}

export interface StockLevelRow {
  itemId: string;
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

export interface ItemDetail extends ItemRow {
  levels: Omit<StockLevelRow, 'itemId'>[];
}

export interface LocationRow {
  id: string;
  name: string;
  zone: string;
}

export interface MovementRow {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  fromLocName: string | null;
  toLocName: string | null;
  note: string | null;
  userEmail: string;
  createdAt: string;
}

export interface LowStockRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorderAt: number;
  totalQty: number;
  /** reorderAt - totalQty; how many units short of the threshold. */
  deficit: number;
}

export interface SettingEntry {
  service: string;
  key: string;
  label: string;
  /** Masked when the descriptor marks the key secret. */
  value: string;
  configured: boolean;
  source: 'env' | 'db' | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}
