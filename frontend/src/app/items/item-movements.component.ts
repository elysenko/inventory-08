import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Movement } from '../core/models';
import { queryText } from '../core/query-params';

@Component({
  selector: 'app-item-movements',
  imports: [DatePipe, RouterLink],
  templateUrl: './item-movements.component.html',
  styleUrl: './item-movements.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemMovementsComponent {
  /** Inherited from the parent `items/:id` route. */
  readonly id = input('', { transform: queryText });

  readonly movements = signal<Movement[]>([
    { id: 'mv-31', type: 'OUT', itemId: 'itm-1003', itemSku: 'WH-1003', itemName: 'Packing Tape 48mm', qty: 18, fromLocName: 'Pick Face B2', toLocName: null, note: 'Outbound wave 4471', userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-05T15:42:00Z' },
    { id: 'mv-30', type: 'TRANSFER', itemId: 'itm-1001', itemSku: 'WH-1001', itemName: 'M8 Hex Bolt, Zinc Plated', qty: 60, fromLocName: 'Bulk Racking A1', toLocName: 'Pick Face B2', note: 'Pick face replenishment', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-09-05T11:08:00Z' },
    { id: 'mv-29', type: 'IN', itemId: 'itm-1006', itemSku: 'WH-1006', itemName: 'Stretch Wrap 500mm', qty: 100, fromLocName: null, toLocName: 'Bulk Racking A1', note: 'PO-88213 received', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-09-04T09:15:00Z' },
    { id: 'mv-28', type: 'OUT', itemId: 'itm-1002', itemSku: 'WH-1002', itemName: 'Nitrile Gloves, Large', qty: 14, fromLocName: 'Pick Face B2', toLocName: null, note: 'Issued to packing line', userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-03T16:30:00Z' },
    { id: 'mv-27', type: 'OUT', itemId: 'itm-1007', itemSku: 'WH-1007', itemName: 'Safety Goggles, Clear', qty: 12, fromLocName: 'Bulk Racking A1', toLocName: null, note: 'Site safety refresh', userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-09-03T08:05:00Z' },
    { id: 'mv-26', type: 'TRANSFER', itemId: 'itm-1003', itemSku: 'WH-1003', itemName: 'Packing Tape 48mm', qty: 8, fromLocName: 'Bulk Racking A1', toLocName: 'Pick Face B2', note: null, userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-02T13:20:00Z' },
    { id: 'mv-25', type: 'IN', itemId: 'itm-1004', itemSku: 'WH-1004', itemName: 'Euro Pallet 1200x800', qty: 90, fromLocName: null, toLocName: 'Goods-In Bay', note: 'Pallet return from carrier', userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-09-01T10:00:00Z' },
    { id: 'mv-24', type: 'IN', itemId: 'itm-1001', itemSku: 'WH-1001', itemName: 'M8 Hex Bolt, Zinc Plated', qty: 540, fromLocName: null, toLocName: 'Bulk Racking A1', note: 'PO-88190 received', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-08-31T07:45:00Z' },
    { id: 'mv-23', type: 'IN', itemId: 'itm-1008', itemSku: 'WH-1008', itemName: 'Cable Tie 200mm', qty: 320, fromLocName: null, toLocName: 'Bulk Racking A1', note: null, userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-08-29T12:10:00Z' },
    { id: 'mv-22', type: 'IN', itemId: 'itm-1005', itemSku: 'WH-1005', itemName: 'Thermal Label 4x6', qty: 30, fromLocName: null, toLocName: 'Pick Face B2', note: 'Short delivery — 20 rolls backordered', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-08-28T14:55:00Z' },
  ]);

  readonly rows = computed<Movement[]>(() =>
    this.movements().filter((row) => row.itemId === this.id()),
  );

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }
}
