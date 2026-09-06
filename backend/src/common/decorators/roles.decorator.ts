import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the listed roles. ADMIN is always allowed in addition
 * to whatever is listed here (see RolesGuard) — admins hold every manager
 * permission, matching the frontend's `isManager` computed signal.
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
