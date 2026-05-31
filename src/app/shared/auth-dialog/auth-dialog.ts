import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoaderCircle, Eye, EyeOff, LockKeyhole, LucideAngularModule, X } from 'lucide-angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './auth-dialog.html',
  styleUrl: './auth-dialog.css',
})
export class AuthDialog {
  private readonly auth = inject(AuthService);

  readonly closed = output<void>();
  readonly authenticated = output<void>();

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  readonly LockIcon = LockKeyhole;
  readonly LoaderIcon = LoaderCircle;
  readonly CloseIcon = X;
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  onEmailInput(value: string): void {
    this.email.set(value);
  }

  onPasswordInput(value: string): void {
    this.password.set(value);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.errorMessage.set('Enter your email and password.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      await this.auth.signInWithPassword(email, password);
      this.authenticated.emit();
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private toMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unable to sign in. Please try again.';
  }
}
