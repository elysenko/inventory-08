import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from `?returnUrl=` by withComponentInputBinding. */
  returnUrl?: string;

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldError = signal<'email' | 'password' | null>(null);

  /**
   * Preview-only affordance. The label lives in TypeScript behind the
   * build-time constant so esbuild strips both the branch and the string from
   * production bundles; a runtime flag would leave it shipped.
   */
  readonly previewShortcut: string | null = COLOSSUS_PREVIEW
    ? 'Skip login — Demo Mode'
    : null;

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.fieldError.set(null);

    const result = await this.auth.login(this.email(), this.password());
    this.submitting.set(false);

    if (!result.ok) {
      this.fieldError.set(result.field ?? null);
      this.formError.set(result.message ?? 'Invalid credentials.');
      return;
    }
    this.goToApp();
  }

  /** Seeds the signed-in state directly — no credentials involved. */
  skipLogin(role: Role = 'ADMIN'): void {
    this.auth.previewSignIn(role);
    this.goToApp();
  }

  private goToApp(): void {
    void this.router.navigateByUrl(this.returnUrl || '/items');
  }
}
