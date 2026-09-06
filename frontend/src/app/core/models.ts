/**
 * Response shapes shared by the StockRoom UI.
 * These mirror the REST surface under /api exactly, so the service layer can
 * swap the components' mock signal initialisers for real HTTP calls without
 * touching a single template.
 */

export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** A row of GET /api/items — `totalQty` is the summed StockLevel balance. */
export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  reorderAt: number;
  totalQty: number;
}

/** One per-location balance inside GET /api/items/:id. */
export interface StockLevelRow {
  /** Present on the flat StockLevel feed; omitted inside GET /api/items/:id. */
  itemId?: string;
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

/** GET /api/items/:id — the item plus its per-location breakdown. */
export interface ItemDetail extends Item {
  levels: StockLevelRow[];
}

export interface Location {
  id: string;
  name: string;
  zone: string;
}

/** A row of GET /api/movements — immutable audit record. */
export interface Movement {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  fromLocName?: string | null;
  toLocName?: string | null;
  note?: string | null;
  userEmail: string;
  createdAt: string;
}

/** A row of GET /api/reports/low-stock. */
export interface LowStockRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorderAt: number;
  totalQty: number;
  deficit: number;
}

/** A row of GET /api/admin/settings — values arrive masked. */
export interface SettingEntry {
  service: string;
  key: string;
  label: string;
  value: string;
  configured: boolean;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const MOVEMENT_TYPES: MovementType[] = ['IN', 'OUT', 'TRANSFER'];

export const ROLE_LABEL: Record<Role, string> = {
  USER: 'Clerk',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};
