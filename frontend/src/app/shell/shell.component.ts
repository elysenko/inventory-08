import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ROLE_LABEL, Role } from '../core/models';

export interface NavItem {
  label: string;
  short: string;
  icon: string;
  path: string;
  /** Exact matching for links whose sibling routes share a prefix. */
  exact: boolean;
  /** Lowest role that may see the entry. */
  minRole: Role;
}

const NAV: NavItem[] = [
  { label: 'Items', short: 'Items', icon: '📦', path: '/items', exact: false, minRole: 'USER' },
  { label: 'Record movement', short: 'Record', icon: '🔁', path: '/movements/new', exact: true, minRole: 'USER' },
  { label: 'Locations', short: 'Places', icon: '🗺️', path: '/locations', exact: true, minRole: 'MANAGER' },
  { label: 'Low stock', short: 'Low', icon: '📉', path: '/reports/low-stock', exact: true, minRole: 'MANAGER' },
  { label: 'Audit log', short: 'Log', icon: '🧾', path: '/movements', exact: true, minRole: 'MANAGER' },
  { label: 'Settings', short: 'Setup', icon: '⚙️', path: '/admin/settings', exact: true, minRole: 'ADMIN' },
];

const RANK: Record<Role, number> = { USER: 0, MANAGER: 1, ADMIN: 2 };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly role = this.auth.role;
  readonly roleLabel = ROLE_LABEL;

  readonly drawerOpen = signal(false);

  /** Nav entries the signed-in role is allowed to see. */
  readonly navItems = computed<NavItem[]>(() =>
    NAV.filter((item) => RANK[this.role()] >= RANK[item.minRole]),
  );

  /**
   * Bottom tab bar: up to five entries fit comfortably at 375px. Anything
   * beyond that collapses into a "More" tab backed by the drawer, so no nav
   * destination is ever unreachable on a phone.
   */
  readonly tabItems = computed<NavItem[]>(() => {
    const items = this.navItems();
    return items.length > 5 ? items.slice(0, 4) : items;
  });

  readonly hasMoreTab = computed(() => this.navItems().length > 5);

  readonly initials = computed(() => {
    const source = this.user()?.name || this.user()?.email || 'SR';
    return source
      .split(/[\s.@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  logout(): void {
    this.closeDrawer();
    this.auth.logout();
  }
}
