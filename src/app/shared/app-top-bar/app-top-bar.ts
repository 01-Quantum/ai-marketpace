import { Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ShieldCheck, User } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './app-top-bar.html',
})
export class AppTopBar {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly brandTag = input('Quantum FHE Enclave');

  readonly displayName = this.auth.displayName;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly signOut = output<void>();

  readonly isInStudio = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.isStudioRoute()),
      startWith(this.isStudioRoute()),
    ),
    { initialValue: this.isStudioRoute() },
  );

  readonly isModelOwner = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.isModelOwnerRoute()),
      startWith(this.isModelOwnerRoute()),
    ),
    { initialValue: this.isModelOwnerRoute() },
  );

  readonly ShieldCheckIcon = ShieldCheck;
  readonly UserIcon = User;

  async onSignOut(): Promise<void> {
    await this.auth.signOut();
    this.signOut.emit();
    this.router.navigate(['/landing-page']);
  }

  private isStudioRoute(): boolean {
    return this.router.url.startsWith('/model-builder-studio');
  }

  private isModelOwnerRoute(): boolean {
    const url = this.router.url.split('?')[0];
    return (
      url.startsWith('/model-owner-workspace') || url.startsWith('/model-builder-studio')
    );
  }
}
