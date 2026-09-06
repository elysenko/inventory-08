import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.formError.set(null);
    this.emailError.set(null);
    this.passwordError.set(null);

    if (this.password() !== this.confirm()) {
      this.passwordError.set('Both passwords must match.');
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.signup(
      this.email(),
      this.password(),
      this.name(),
    );
    this.submitting.set(false);

    if (!result.ok) {
      // The API surfaces a duplicate email as a 400 on the email field.
      if (result.field === 'email') {
        this.emailError.set(result.message ?? 'That email is already in use.');
      } else if (result.field === 'password') {
        this.passwordError.set(result.message ?? 'Choose a stronger password.');
      } else {
        this.formError.set(result.message ?? 'Could not create your account.');
      }
      return;
    }
    void this.router.navigateByUrl('/items');
  }
}
