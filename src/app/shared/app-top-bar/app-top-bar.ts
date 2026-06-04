import { Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Landmark, ShieldCheck, User } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../auth.service';
import { WorkflowRole } from '../workflow.types';

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
  /** Emitted when navigation requires sign-in (e.g. from landing page). */
  readonly authRequired = output<string>();

  readonly activeRole = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.roleFromUrl(this.router.url)),
      startWith(this.roleFromUrl(this.router.url)),
    ),
    { initialValue: this.roleFromUrl(this.router.url) },
  );

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
  readonly LandmarkIcon = Landmark;

  setRole(next: WorkflowRole): void {
    if (next === this.activeRole()) return;

    const destination =
      next === 'model' ? '/model-builder-studio' : '/data-owner-workspace';

    if (this.auth.isAuthenticated()) {
      void this.router.navigate([destination]);
      return;
    }

    this.authRequired.emit(destination);
  }

  async onSignOut(): Promise<void> {
    await this.auth.signOut();
    this.signOut.emit();
    void this.router.navigate(['/landing-page']);
  }

  private roleFromUrl(url: string): WorkflowRole {
    const path = url.split('?')[0];
    if (
      path.startsWith('/model-builder-studio') ||
      path.startsWith('/model-owner-workspace')
    ) {
      return 'model';
    }
    return 'data';
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
