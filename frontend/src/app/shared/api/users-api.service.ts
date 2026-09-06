import { Injectable, inject } from '@angular/core';

import { User } from '../../core/models';
import { ApiClient } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiClient);

  /** All accounts. Manager-only. */
  listUsers(): Promise<User[]> {
    return this.api.get<User[]>('/users');
  }

  /** The account behind the current bearer token. */
  me(): Promise<User> {
    return this.api.get<User>('/auth/me');
  }
}
